import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "installer-version.json");
const tauriConfigPath = path.join(repoRoot, "frontend", "src-tauri", "tauri.conf.json");
const trackedInputs = [
  ".github/workflows/build-devtest.yml",
  ".github/workflows/build-linux.yml",
  ".github/workflows/build-macos.yml",
  ".github/workflows/build-windows.yml",
  "LICENSE.md",
  "frontend/package.json",
  "frontend/src-tauri/icons",
  "frontend/src-tauri/installer",
  "frontend/src-tauri/tauri.conf.json",
  "frontend/src-tauri/tauri.local.conf.json",
  "scripts/brand",
  "scripts/verify-installer-assets.py",
  "scripts/verify-installer-branding.ps1"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listFiles(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) return [relativePath.replaceAll("\\", "/")];
  return fs.readdirSync(absolutePath, { withFileTypes: true })
    .flatMap((entry) => listFiles(path.join(relativePath, entry.name)))
    .sort();
}

function fingerprint() {
  const hash = crypto.createHash("sha256");
  for (const relativePath of trackedInputs.flatMap(listFiles).sort()) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(repoRoot, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function validateManifest(manifest) {
  const appVersion = readJson(tauriConfigPath).version;
  if (manifest.appVersion !== appVersion) {
    throw new Error(`Application version is ${appVersion}, but installer-version.json records ${manifest.appVersion}. Run: node scripts/installer-version.mjs bump`);
  }
  if (!Number.isInteger(manifest.revision) || manifest.revision < 1) {
    throw new Error("Installer revision must be a positive integer.");
  }
  const currentFingerprint = fingerprint();
  if (manifest.sourceFingerprint !== currentFingerprint) {
    throw new Error(`Installer inputs changed without a revision bump. Current revision is ${manifest.revision}. Run: node scripts/installer-version.mjs bump`);
  }
  return { appVersion, currentFingerprint };
}

function bump() {
  const manifest = readJson(manifestPath);
  const appVersion = readJson(tauriConfigPath).version;
  manifest.schemaVersion = 1;
  manifest.revision = manifest.appVersion === appVersion ? manifest.revision + 1 : 1;
  manifest.appVersion = appVersion;
  manifest.sourceFingerprint = fingerprint();
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Installer version: ${appVersion}_installer.${manifest.revision}`);
}

function findBundleFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(directory, entry.name);
    return entry.isDirectory() ? findBundleFiles(child) : [child];
  });
}

function stamp() {
  const manifest = readJson(manifestPath);
  const { appVersion } = validateManifest(manifest);
  const bundleRoots = [path.join(repoRoot, "target"), path.join(repoRoot, "frontend", "src-tauri", "target")];
  const versionMarker = `_${appVersion}_`;
  const revisionMarker = `_${appVersion}_installer.${manifest.revision}_`;
  const candidates = bundleRoots.flatMap(findBundleFiles).filter((filePath) => {
    const normalized = filePath.replaceAll("\\", "/");
    return normalized.includes("/bundle/") && path.basename(filePath).includes(versionMarker) && !path.basename(filePath).includes(revisionMarker);
  });
  if (candidates.length === 0) throw new Error(`No unstamped ${appVersion} bundle artifacts were found.`);
  for (const source of candidates) {
    const destination = path.join(path.dirname(source), path.basename(source).replace(versionMarker, revisionMarker));
    fs.copyFileSync(source, destination);
    fs.unlinkSync(source);
    console.log(path.relative(repoRoot, destination));
  }
}

const command = process.argv[2];
try {
  if (command === "bump") bump();
  else if (command === "verify") {
    const manifest = readJson(manifestPath);
    validateManifest(manifest);
    console.log(`Installer version: ${manifest.appVersion}_installer.${manifest.revision}`);
  } else if (command === "stamp") stamp();
  else throw new Error("Usage: node scripts/installer-version.mjs <bump|verify|stamp>");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
