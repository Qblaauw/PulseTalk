#!/usr/bin/env node

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(frontendDir, '..');
const binariesDir = path.join(frontendDir, 'src-tauri', 'binaries');

const SUPPORTED_TARGETS = Object.freeze({
  'x86_64-pc-windows-msvc': { architecture: 'x86_64', format: 'PE' },
  'x86_64-apple-darwin': { architecture: 'x86_64', format: 'Mach-O' },
  'aarch64-apple-darwin': { architecture: 'aarch64', format: 'Mach-O' },
  'x86_64-unknown-linux-gnu': { architecture: 'x86_64', format: 'ELF' },
  'aarch64-unknown-linux-gnu': { architecture: 'aarch64', format: 'ELF' },
});

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    fail(`Could not run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${command} exited with status ${result.status}`);
  }

  return result;
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error) {
    fail(`Could not run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${command} exited with status ${result.status}: ${result.stderr.trim()}`);
  }

  return result.stdout;
}

function hostTarget() {
  const match = capture('rustc', ['-vV']).match(/^host:\s+([^\s]+)$/m);
  if (!match) {
    fail('Could not read the host target from rustc -vV');
  }
  return match[1];
}

function validateTarget(target) {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(target)) {
    fail(`Invalid Rust target triple: ${target}`);
  }

  if (!SUPPORTED_TARGETS[target]) {
    fail(`PulseTalq has no sidecar assets for target ${target}`);
  }

  const availableTargets = new Set(
    capture('rustc', ['--print', 'target-list'])
      .split(/\r?\n/)
      .filter(Boolean),
  );
  if (!availableTargets.has(target)) {
    fail(`Rust does not recognize target triple ${target}`);
  }

  return target;
}

function helperFeature(feature) {
  if (!feature || feature === 'none' || feature === 'cpu') {
    return null;
  }
  if (feature === 'coreml') {
    return 'metal';
  }
  if (['metal', 'cuda', 'vulkan'].includes(feature)) {
    return feature;
  }
  if (['openblas', 'hipblas'].includes(feature)) {
    return null;
  }
  fail(`Unsupported GPU feature: ${feature}`);
}

function normalizeFeature(feature) {
  const normalized = feature || 'none';
  helperFeature(normalized);
  return normalized === 'cpu' ? 'none' : normalized;
}

function parseClangMajor(versionOutput) {
  const match = versionOutput.trim().match(/^(?:(?:Apple\s+)?clang version\s+)?(\d+)(?:\.\d+)?/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function windowsFileVersion(filePath) {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '(Get-Item -LiteralPath $env:PULSETALQ_LIBCLANG_DLL).VersionInfo.FileVersion',
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, PULSETALQ_LIBCLANG_DLL: filePath },
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function prepareWindowsLibclang(target) {
  if (!target.includes('windows')) return null;

  const pathValue = process.env.PATH || process.env.Path || '';
  const candidates = [
    process.env.LIBCLANG_PATH,
    ...pathValue.split(path.delimiter),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'LLVM', 'bin'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'LLVM', 'bin'),
  ].filter(Boolean);

  const libclangDir = candidates.find((candidate) =>
    ['libclang.dll', 'clang.dll'].some((name) => fs.existsSync(path.join(candidate, name))),
  );

  if (!libclangDir) {
    fail(
      'Windows builds require LLVM 18 or 19. Set LIBCLANG_PATH to the directory containing libclang.dll; see docs/BUILDING.md.',
    );
  }

  const dllPath = ['libclang.dll', 'clang.dll']
    .map((name) => path.join(libclangDir, name))
    .find((candidate) => fs.existsSync(candidate));
  const clangPath = path.join(libclangDir, 'clang.exe');
  let versionOutput = null;
  if (fs.existsSync(clangPath)) {
    const version = spawnSync(clangPath, ['--version'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (version.error || version.status !== 0) {
      fail(`Could not verify the clang version in ${libclangDir}`);
    }

    versionOutput = `${version.stdout}\n${version.stderr}`;
  } else {
    versionOutput = windowsFileVersion(dllPath);
  }

  const major = versionOutput ? parseClangMajor(versionOutput) : null;
  if (!major) {
    fail(`Could not verify the LLVM version for ${dllPath}; use LLVM 18 or 19`);
  }
  if (![18, 19].includes(major)) {
    fail(`LLVM ${major} is not supported by whisper-rs-sys 0.11.1 on Windows; use LLVM 18 or 19`);
  }

  process.env.LIBCLANG_PATH = libclangDir;
  console.log(`Using LLVM ${major} libclang from ${libclangDir}`);
  return libclangDir;
}

function executableSuffix(target) {
  return target.includes('windows') ? '.exe' : '';
}

function cargoTargetDir(target, configuredTargetDir = process.env.CARGO_TARGET_DIR) {
  if (configuredTargetDir) return path.resolve(workspaceRoot, configuredTargetDir);
  if (!target.includes('windows')) return path.join(workspaceRoot, 'target');

  // Native CMake dependencies create deeply nested MSBuild paths. A short
  // target directory avoids the legacy 260-character limit on Windows.
  const workspaceId = crypto.createHash('sha256').update(workspaceRoot).digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), 'pt-sidecars', workspaceId);
}

function expectedFormat(target) {
  const spec = SUPPORTED_TARGETS[target];
  if (!spec) fail(`PulseTalq has no sidecar assets for target ${target}`);
  return spec.format;
}

function architectureName(machine) {
  if ([0x8664, 0x3e, 0x01000007].includes(machine)) return 'x86_64';
  if ([0xaa64, 0xb7, 0x0100000c].includes(machine)) return 'aarch64';
  return `unknown-0x${machine.toString(16)}`;
}

function inspectExecutable(header) {
  if (header.length >= 64 && header[0] === 0x4d && header[1] === 0x5a) {
    const peOffset = header.readUInt32LE(0x3c);
    if (peOffset + 6 > header.length || header.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') {
      return { architectures: [], format: 'PE' };
    }
    return { architectures: [architectureName(header.readUInt16LE(peOffset + 4))], format: 'PE' };
  }

  if (header.length >= 20 && header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
    const machine = header[5] === 1 ? header.readUInt16LE(18) : header.readUInt16BE(18);
    return { architectures: [architectureName(machine)], format: 'ELF' };
  }

  if (header.length >= 8) {
    const magic = header.readUInt32BE(0);
    const thinEndianness = new Map([
      [0xfeedface, 'BE'],
      [0xfeedfacf, 'BE'],
      [0xcefaedfe, 'LE'],
      [0xcffaedfe, 'LE'],
    ]);
    if (thinEndianness.has(magic)) {
      const machine = thinEndianness.get(magic) === 'LE' ? header.readUInt32LE(4) : header.readUInt32BE(4);
      return { architectures: [architectureName(machine)], format: 'Mach-O' };
    }

    if (magic === 0xcafebabe) {
      const count = header.readUInt32BE(4);
      const architectures = [];
      for (let index = 0; index < count && 8 + index * 20 + 4 <= header.length; index += 1) {
        architectures.push(architectureName(header.readUInt32BE(8 + index * 20)));
      }
      return { architectures, format: 'Mach-O' };
    }
  }

  return { architectures: [], format: 'unknown' };
}

function detectFormat(header) {
  return inspectExecutable(header).format;
}

function verifyBinary(binaryPath, target) {
  if (!fs.existsSync(binaryPath)) {
    fail(`Missing sidecar: ${binaryPath}`);
  }

  const stat = fs.statSync(binaryPath);
  if (!stat.isFile() || stat.size < 4) {
    fail(`Sidecar is not a non-empty file: ${binaryPath}`);
  }

  const fd = fs.openSync(binaryPath, 'r');
  const header = Buffer.alloc(Math.min(stat.size, 4096));
  try {
    fs.readSync(fd, header, 0, header.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  const inspection = inspectExecutable(header);
  const actual = inspection.format;
  const expected = expectedFormat(target);
  if (actual !== expected) {
    fail(`Sidecar ${path.basename(binaryPath)} is ${actual}, expected ${expected} for ${target}`);
  }

  const expectedArchitecture = SUPPORTED_TARGETS[target].architecture;
  if (!inspection.architectures.includes(expectedArchitecture)) {
    fail(
      `Sidecar ${path.basename(binaryPath)} has architecture ${inspection.architectures.join(', ') || 'unknown'}, expected ${expectedArchitecture}`,
    );
  }

  if (!target.includes('windows') && (stat.mode & 0o111) === 0) {
    fail(`Sidecar is not executable: ${binaryPath}`);
  }

  console.log(
    `Verified ${path.relative(frontendDir, binaryPath)} (${actual}, ${expectedArchitecture}, ${stat.size} bytes)`,
  );
}

function parseArgs(argv) {
  const options = {
    check: false,
    feature: process.env.TAURI_GPU_FEATURE || 'none',
    profile: 'debug',
    target: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') {
      options.check = true;
    } else if (arg === '--profile' || arg === '--target' || arg === '--feature') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`Missing value for ${arg}`);
      options[arg.slice(2)] = value;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  if (!['debug', 'release'].includes(options.profile)) {
    fail(`Invalid profile ${options.profile}; use debug or release`);
  }
  options.feature = normalizeFeature(options.feature);

  return options;
}

function sidecarPaths(target) {
  const suffix = executableSuffix(target);
  return {
    ffmpeg: path.join(binariesDir, `ffmpeg-${target}${suffix}`),
    llama: path.join(binariesDir, `llama-helper-${target}${suffix}`),
  };
}

function prepare(options) {
  const target = validateTarget(options.target || hostTarget());
  const paths = sidecarPaths(target);

  if (options.check) {
    verifyBinary(paths.llama, target);
    verifyBinary(paths.ffmpeg, target);
    console.log(`All Tauri sidecars are ready for ${target}`);
    return;
  }

  prepareWindowsLibclang(target);
  const feature = helperFeature(options.feature);
  const targetDir = cargoTargetDir(target);
  const cargoArgs = ['build', '--locked', '--package', 'llama-helper', '--target', target];
  if (options.profile === 'release') cargoArgs.push('--release');
  if (feature) cargoArgs.push('--features', feature);

  const featureLabel = feature || 'cpu';
  console.log(`Building llama-helper for ${target}, profile ${options.profile}, feature ${featureLabel}`);
  console.log(`Using Cargo target directory ${targetDir}`);
  run('cargo', cargoArgs, { env: { ...process.env, CARGO_TARGET_DIR: targetDir } });

  const source = path.join(
    targetDir,
    target,
    options.profile,
    `llama-helper${executableSuffix(target)}`,
  );
  verifyBinary(source, target);

  fs.mkdirSync(binariesDir, { recursive: true });
  fs.copyFileSync(source, paths.llama);
  if (!target.includes('windows')) fs.chmodSync(paths.llama, 0o755);
  verifyBinary(paths.llama, target);

  console.log('llama-helper is ready. The PulseTalq Rust build script acquires and verifies FFmpeg.');
}

function printHelp() {
  console.log(`Usage: node scripts/prepare-sidecars.js [options]

Options:
  --profile debug|release  Build profile for llama-helper; defaults to debug
  --target <triple>        Rust target triple; defaults to the rustc host
  --feature <name>         none, cuda, vulkan, metal, coreml, openblas, or hipblas
  --check                  Read-only validation of both target-named sidecars
  --help                   Show this help

Run --check after cargo check or a Tauri build. The Rust build script downloads
and validates FFmpeg; this command builds and copies llama-helper.`);
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }
  prepare(options);
}

module.exports = {
  detectFormat,
  cargoTargetDir,
  executableSuffix,
  expectedFormat,
  helperFeature,
  hostTarget,
  inspectExecutable,
  normalizeFeature,
  parseClangMajor,
  parseArgs,
  prepareWindowsLibclang,
  sidecarPaths,
  SUPPORTED_TARGETS,
  windowsFileVersion,
};

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`Sidecar preparation failed: ${error.message}`);
    process.exit(1);
  }
}
