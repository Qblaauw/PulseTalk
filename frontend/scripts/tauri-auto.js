#!/usr/bin/env node
/**
 * Auto-detect GPU and run Tauri with appropriate features
 */

const { execFileSync } = require('child_process');
const path = require('path');
const os = require('os');
const {
  cargoTargetDir,
  hostTarget,
  normalizeFeature,
  prepareWindowsLibclang,
} = require('./prepare-sidecars');

// Get the command (dev or build)
const command = process.argv[2];
if (!command || !['dev', 'build'].includes(command)) {
  console.error('Usage: node tauri-auto.js [dev|build] [--feature <name>] [-- <tauri arguments>]');
  process.exit(1);
}

const separatorIndex = process.argv.indexOf('--', 3);
const optionArgs = process.argv.slice(3, separatorIndex === -1 ? undefined : separatorIndex);
const tauriArgs = separatorIndex === -1 ? [] : process.argv.slice(separatorIndex + 1);
let forcedFeature = null;
if (optionArgs[0] === '--feature' && optionArgs[1] && optionArgs.length === 2) {
  forcedFeature = optionArgs[1];
} else if (optionArgs.length > 0) {
  console.error('Usage: node tauri-auto.js [dev|build] [--feature <name>] [-- <tauri arguments>]');
  process.exit(1);
}

// Detect GPU feature
let feature = 'none';

// Check for environment variable override first
if (forcedFeature) {
  feature = forcedFeature;
} else if (process.env.TAURI_GPU_FEATURE) {
  feature = process.env.TAURI_GPU_FEATURE;
} else {
  try {
    const result = execFileSync(process.execPath, [path.join(__dirname, 'auto-detect-gpu.js')], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'inherit']
    });
    feature = result.trim();
  } catch (err) {
    // If detection fails, continue with no features
  }
}

try {
  feature = normalizeFeature(feature);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (forcedFeature) console.log(`Using requested GPU feature: ${feature}`);
else if (process.env.TAURI_GPU_FEATURE) console.log(`Using GPU feature from TAURI_GPU_FEATURE: ${feature}`);

console.log(''); // Empty line for spacing

// Platform-specific environment variables
const platform = os.platform();
const env = { ...process.env };
const target = hostTarget();
const libclangPath = prepareWindowsLibclang(target);
if (libclangPath) env.LIBCLANG_PATH = libclangPath;
env.CARGO_TARGET_DIR = cargoTargetDir(target, env.CARGO_TARGET_DIR);

if (platform === 'linux' && feature === 'cuda') {
  console.log('🐧 Linux/CUDA detected: Setting CMAKE flags for NVIDIA GPU');
  env.CMAKE_CUDA_ARCHITECTURES = '75';
  env.CMAKE_CUDA_STANDARD = '17';
  env.CMAKE_POSITION_INDEPENDENT_CODE = 'ON';
}

// Tauri validates externalBin paths before compiling the app. Build and copy
// llama-helper first so a clean worktree does not depend on an untracked file.
const sidecarArgs = [
  path.join(__dirname, 'prepare-sidecars.js'),
  '--target',
  target,
  '--profile',
  command === 'build' ? 'release' : 'debug',
  '--feature',
  feature || 'none',
];

try {
  execFileSync(process.execPath, sidecarArgs, { stdio: 'inherit', env });
} catch (err) {
  process.exit(err.status || 1);
}

env.PULSETALQ_LLAMA_HELPER_PREPARED = '1';

// Build the tauri command
const commandArgs = [command, ...tauriArgs];
if (feature && feature !== 'none') {
  commandArgs.push('--', '--features', feature);
  console.log(`🚀 Running: tauri ${command} with features: ${feature}`);
} else {
  console.log(`🚀 Running: tauri ${command} (CPU-only mode)`);
}
console.log('');

// Execute the command
try {
  const tauriCli = require.resolve('@tauri-apps/cli/tauri.js', { paths: [path.resolve(__dirname, '..')] });
  execFileSync(process.execPath, [tauriCli, ...commandArgs], { stdio: 'inherit', env });
} catch (err) {
  if (err.code === 'MODULE_NOT_FOUND') console.error('Install frontend dependencies before running Tauri.');
  process.exit(err.status || 1);
}
