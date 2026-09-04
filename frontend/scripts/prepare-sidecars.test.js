const assert = require('node:assert/strict');
const test = require('node:test');

const {
  cargoTargetDir,
  detectFormat,
  executableSuffix,
  expectedFormat,
  helperFeature,
  parseClangMajor,
  parseArgs,
  prepareWindowsLibclang,
  sidecarPaths,
} = require('./prepare-sidecars');

test('maps app acceleration features to llama-helper features', () => {
  assert.equal(helperFeature('cuda'), 'cuda');
  assert.equal(helperFeature('vulkan'), 'vulkan');
  assert.equal(helperFeature('coreml'), 'metal');
  assert.equal(helperFeature('openblas'), null);
  assert.equal(helperFeature('none'), null);
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
  assert.equal(detectFormat(Buffer.from([0x4d, 0x5a, 0x00, 0x00])), 'PE');
  assert.equal(detectFormat(Buffer.from([0x7f, 0x45, 0x4c, 0x46])), 'ELF');
  assert.equal(detectFormat(Buffer.from([0xfe, 0xed, 0xfa, 0xcf])), 'Mach-O');
  assert.equal(detectFormat(Buffer.from([0x00, 0x00, 0x00, 0x00])), 'unknown');
  assert.equal(expectedFormat('aarch64-apple-darwin'), 'Mach-O');
});

test('reads supported LLVM major versions from clang output', () => {
  assert.equal(parseClangMajor('clang version 18.1.8'), 18);
  assert.equal(parseClangMajor('Apple clang version 19.1.0'), 19);
  assert.equal(parseClangMajor('unexpected output'), null);
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
