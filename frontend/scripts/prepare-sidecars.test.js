const assert = require('node:assert/strict');
const test = require('node:test');

const {
  cargoTargetDir,
  detectFormat,
  executableSuffix,
  expectedFormat,
  helperFeature,
  inspectExecutable,
  normalizeFeature,
  parseClangMajor,
  parseArgs,
  prepareWindowsLibclang,
  sidecarPaths,
  validateClangVersion,
} = require('./prepare-sidecars');

test('maps app acceleration features to llama-helper features', () => {
  assert.equal(helperFeature('cuda'), 'cuda');
  assert.equal(helperFeature('vulkan'), 'vulkan');
  assert.equal(helperFeature('coreml'), 'metal');
  assert.equal(helperFeature('openblas'), null);
  assert.equal(helperFeature('none'), null);
  assert.equal(normalizeFeature('cpu'), 'none');
  assert.equal(normalizeFeature('cuda'), 'cuda');
  assert.throws(() => helperFeature('invalid'), /Unsupported GPU feature/);
});

test('uses target-triple sidecar names', () => {
  const windows = sidecarPaths('x86_64-pc-windows-msvc');
  assert.match(windows.llama, /llama-helper-x86_64-pc-windows-msvc\.exe$/);
  assert.match(windows.ffmpeg, /ffmpeg-x86_64-pc-windows-msvc\.exe$/);

  const linux = sidecarPaths('x86_64-unknown-linux-gnu');
  assert.match(linux.llama, /llama-helper-x86_64-unknown-linux-gnu$/);
  assert.equal(executableSuffix('aarch64-apple-darwin'), '');
});

test('honors an explicit Cargo target directory', () => {
  assert.match(cargoTargetDir('x86_64-pc-windows-msvc', 'custom-target'), /custom-target$/);
});

test('recognizes executable formats used by supported targets', () => {
  const pe = Buffer.alloc(256);
  pe.write('MZ');
  pe.writeUInt32LE(128, 0x3c);
  pe.write('PE\0\0', 128, 'ascii');
  pe.writeUInt16LE(0x8664, 132);

  const elf = Buffer.alloc(64);
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]).copy(elf);
  elf[5] = 1;
  elf.writeUInt16LE(0xb7, 18);

  const machO = Buffer.alloc(32);
  Buffer.from([0xcf, 0xfa, 0xed, 0xfe]).copy(machO);
  machO.writeUInt32LE(0x0100000c, 4);

  assert.deepEqual(inspectExecutable(pe), { architectures: ['x86_64'], format: 'PE' });
  assert.deepEqual(inspectExecutable(elf), { architectures: ['aarch64'], format: 'ELF' });
  assert.deepEqual(inspectExecutable(machO), { architectures: ['aarch64'], format: 'Mach-O' });
  assert.equal(detectFormat(pe), 'PE');
  assert.equal(detectFormat(Buffer.from([0x00, 0x00, 0x00, 0x00])), 'unknown');
  assert.equal(expectedFormat('aarch64-apple-darwin'), 'Mach-O');
  assert.throws(() => expectedFormat('x86_64-pc-windows-gnu'), /no sidecar assets/);
});

test('reads supported LLVM major versions from clang output', () => {
  assert.equal(parseClangMajor('clang version 18.1.8'), 18);
  assert.equal(parseClangMajor('Apple clang version 19.1.0'), 19);
  assert.equal(parseClangMajor('18.1.1'), 18);
  assert.equal(parseClangMajor('unexpected output'), null);
  assert.equal(validateClangVersion('19.1.7', 'test DLL'), 19);
  assert.throws(() => validateClangVersion('22.1.6', 'test DLL'), /LLVM 22 is not supported/);
  assert.throws(() => validateClangVersion('unknown', 'test DLL'), /Could not verify/);
  assert.equal(prepareWindowsLibclang('x86_64-unknown-linux-gnu'), null);
});

test('parses profile, target, feature, and read-only check mode', () => {
  const options = parseArgs([
    '--profile',
    'release',
    '--target',
    'x86_64-pc-windows-msvc',
    '--feature',
    'cuda',
    '--check',
  ]);

  assert.deepEqual(options, {
    check: true,
    feature: 'cuda',
    profile: 'release',
    target: 'x86_64-pc-windows-msvc',
  });
  assert.throws(() => parseArgs(['--profile', 'fast']), /Invalid profile/);
  assert.throws(() => parseArgs(['--target']), /Missing value/);
});
