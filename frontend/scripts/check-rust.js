#!/usr/bin/env node

const { execFileSync } = require('child_process');
const path = require('path');

const {
  cargoTargetDir,
  hostTarget,
  normalizeFeature,
  prepareWindowsLibclang,
} = require('./prepare-sidecars');

const frontendDir = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(frontendDir, '..');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: pnpm run rust:check

Builds target-named sidecars, runs cargo check with the workspace lockfile, and
then validates both Tauri external binaries. TAURI_GPU_FEATURE selects an
optional app and helper feature. CARGO_TARGET_DIR overrides the build location.`);
  process.exit(0);
}

if (process.argv.length > 2) {
  console.error('Usage: pnpm run rust:check');
  process.exit(1);
}

const target = hostTarget();
prepareWindowsLibclang(target);
const targetDir = cargoTargetDir(target);
let feature;
try {
  feature = normalizeFeature(process.env.TAURI_GPU_FEATURE || 'none');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const env = {
  ...process.env,
  CARGO_TARGET_DIR: targetDir,
  PULSETALQ_LLAMA_HELPER_PREPARED: '1',
};

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, env, stdio: 'inherit' });
}

try {
  console.log(`Using shared Cargo target directory ${targetDir}`);
  run(
    process.execPath,
    [
      path.join(__dirname, 'prepare-sidecars.js'),
      '--target',
      target,
      '--feature',
      feature,
    ],
    frontendDir,
  );

  const cargoArgs = ['check', '--locked', '--package', 'pulse-talq'];
  if (feature !== 'none' && feature !== 'cpu') cargoArgs.push('--features', feature);
  run('cargo', cargoArgs, workspaceRoot);

  run(
    process.execPath,
    [path.join(__dirname, 'prepare-sidecars.js'), '--target', target, '--check'],
    frontendDir,
  );
} catch (error) {
  process.exit(error.status || 1);
}
