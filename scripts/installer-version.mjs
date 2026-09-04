import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "installer-version.json");
const packagePath = path.join(repoRoot, "frontend", "package.json");
const cargoManifestPath = path.join(repoRoot, "frontend", "src-tauri", "Cargo.toml");
const cargoLockPath = path.join(repoRoot, "Cargo.lock");
const tauriConfigPath = path.join(repoRoot, "frontend", "src-tauri", "tauri.conf.json");
const trackedInputs = [
  ".github/workflows/build-devtest.yml",
  ".github/workflows/build-linux.yml",
  ".github/workflows/build-macos.yml",
  ".github/workflows/build-windows.yml",
  "LICENSE.md",
  "frontend/package.json",
  "frontend/scripts/prepare-sidecars.js",
  "frontend/scripts/tauri-auto.js",
  "frontend/src-tauri/Cargo.toml",
  "frontend/src-tauri/icons",
  "frontend/src-tauri/installer",
  "frontend/src-tauri/tauri.conf.json",
  "frontend/src-tauri/tauri.local.conf.json",
  "scripts/brand",
  "scripts/installer-version.mjs",
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
    const absolutePath = path.join(repoRoot, relativePath);
    const extension = path.extname(relativePath).toLowerCase();
    const textExtensions = new Set([".json", ".js", ".mjs", ".md", ".ps1", ".py", ".svg", ".toml", ".yaml", ".yml"]);
    const contents = textExtensions.has(extension)
      ? fs.readFileSync(absolutePath, "utf8").replaceAll("\r\n", "\n")
      : fs.readFileSync(absolutePath);
    hash.update(contents);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function firstCargoPackageVersion(contents) {
  const packageStart = contents.search(/^\[package\]\s*$/m);
  if (packageStart < 0) throw new Error("Could not find [package] in frontend/src-tauri/Cargo.toml.");
  const remainder = contents.slice(packageStart + "[package]".length);
  const nextSection = remainder.search(/^\[/m);
  const packageSection = nextSection < 0 ? remainder : remainder.slice(0, nextSection);
  const version = packageSection.match(/^version\s*=\s*"([^"]+)"\s*$/m)?.[1];
  if (!version) throw new Error("Could not read the PulseTalq version from frontend/src-tauri/Cargo.toml.");
  return version;
}

function pulseTalqLockVersion(contents) {
  const packageBlock = contents.match(/\[\[package\]\]\s*\r?\nname = "pulse-talq"\s*\r?\nversion = "([^"]+)"/);
  if (!packageBlock) throw new Error("Could not read the PulseTalq version from Cargo.lock.");
  return packageBlock[1];
}

function appVersions() {
  return {
    "frontend/package.json": readJson(packagePath).version,
    "frontend/src-tauri/Cargo.toml": firstCargoPackageVersion(fs.readFileSync(cargoManifestPath, "utf8")),
    "frontend/src-tauri/tauri.conf.json": readJson(tauriConfigPath).version,
    "Cargo.lock": pulseTalqLockVersion(fs.readFileSync(cargoLockPath, "utf8"))
  };
}

function validateAppVersions() {
  const versions = appVersions();
  const uniqueVersions = new Set(Object.values(versions));
  if (uniqueVersions.size !== 1) {
    const detail = Object.entries(versions).map(([file, version]) => `${file}=${version}`).join(", ");
    throw new Error(`Application versions do not match: ${detail}`);
  }
  return Object.values(versions)[0];
}

function validateManifest(manifest) {
  const appVersion = validateAppVersions();
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
  const appVersion = validateAppVersions();
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

function cargoTargetRoot() {
  const configured = process.env.CARGO_TARGET_DIR;
  if (!configured) return path.join(repoRoot, "target");
  return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
}

function stamp() {
  const manifest = readJson(manifestPath);
  const { appVersion } = validateManifest(manifest);
  const bundleRoots = [
    cargoTargetRoot(),
    path.join(repoRoot, "target"),
    path.join(repoRoot, "frontend", "src-tauri", "target")
  ];
  const versionMarker = `_${appVersion}_`;
  const revisionMarker = `_${appVersion}_installer.${manifest.revision}_`;
  const candidates = [...new Set(bundleRoots.flatMap(findBundleFiles))].filter((filePath) => {
    const normalized = filePath.replaceAll("\\", "/");
    const filename = path.basename(filePath);
    return normalized.includes("/bundle/")
      && filename.includes(versionMarker)
      && !/_installer\.\d+_/.test(filename);
  });
  if (candidates.length === 0) throw new Error(`No unstamped ${appVersion} bundle artifacts were found.`);
  for (const source of candidates) {
    const destination = path.join(path.dirname(source), path.basename(source).replace(versionMarker, revisionMarker));
    fs.renameSync(source, destination);
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
