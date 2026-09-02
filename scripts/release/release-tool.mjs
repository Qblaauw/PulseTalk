#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "../..");
const TAURI_CONFIG = join(ROOT, "frontend", "src-tauri", "tauri.conf.json");
const PACKAGE_JSON = join(ROOT, "frontend", "package.json");
const CARGO_TOML = join(ROOT, "frontend", "src-tauri", "Cargo.toml");
const DEFAULT_REPOSITORY = "Qblaauw/PulseTalq";
const RELEASE_PLATFORMS = new Set(["windows", "macos", "linux"]);

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
  return false;
}

function info(message) {
  console.log(`OK: ${message}`);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function normalizePath(file) {
  return file.split(sep).join("/");
}

function parseArgs(values) {
  const result = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      result._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: options.inherit ? "inherit" : "pipe",
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function requireArg(args, name) {
  const value = args[name];
  if (!value || value === true) {
    fail(`Missing required --${name} value.`);
    return null;
  }
  return String(value);
}

function getCargoVersion() {
  const cargo = readFileSync(CARGO_TOML, "utf8");
  const packageSection = cargo.match(/\[package\]([\s\S]*?)(?:\n\[|$)/);
  const version = packageSection?.[1].match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!version) {
    throw new Error("Could not read the package version from Cargo.toml.");
  }
  return version;
}

function getConfig() {
  return {
    tauri: readJson(TAURI_CONFIG),
    packageJson: readJson(PACKAGE_JSON),
    cargoVersion: getCargoVersion(),
  };
}

function validateConfig({ quiet = false } = {}) {
  let valid = true;
  let config;
  try {
    config = getConfig();
  } catch (error) {
    fail(error.message);
    return null;
  }

  const versions = [config.tauri.version, config.packageJson.version, config.cargoVersion];
  if (new Set(versions).size !== 1) {
    valid = fail(`Version mismatch: tauri=${versions[0]}, package=${versions[1]}, cargo=${versions[2]}`);
  }
  if (config.tauri.productName !== "PulseTalq") {
    valid = fail(`Tauri productName must be PulseTalq, found ${config.tauri.productName}.`);
  }
  if (config.tauri.identifier !== "com.pulsetalq.app") {
    valid = fail(`Tauri identifier must be com.pulsetalq.app, found ${config.tauri.identifier}.`);
  }
  if (config.packageJson.name !== "pulse-talq") {
    valid = fail(`Frontend package name must be pulse-talq, found ${config.packageJson.name}.`);
  }

  const endpoints = config.tauri.plugins?.updater?.endpoints || [];
  if (!endpoints.some((endpoint) => endpoint.includes("github.com/Qblaauw/PulseTalq/releases"))) {
    valid = fail("The updater endpoint must target Qblaauw/PulseTalq GitHub Releases.");
  }

  const icons = config.tauri.bundle?.icon || [];
  if (icons.length === 0) {
    valid = fail("No Tauri bundle icons are configured.");
  }
  for (const icon of icons) {
    const iconPath = join(ROOT, "frontend", "src-tauri", icon);
    if (!existsSync(iconPath)) {
      valid = fail(`Configured icon does not exist: ${normalizePath(relative(ROOT, iconPath))}`);
    }
  }

  if (!valid) {
    return null;
  }
  if (!quiet) {
    info(`PulseTalq identity and version ${versions[0]} are consistent.`);
    info(`${icons.length} configured bundle icons exist.`);
    info("Updater points to Qblaauw/PulseTalq GitHub Releases.");
  }
  return config;
}

function currentVersion() {
  try {
    console.log(readJson(TAURI_CONFIG).version);
  } catch (error) {
    fail(error.message);
  }
}

function toolVersion(label, command, args, required) {
  const result = run(command, args);
  if (!result.ok) {
    const message = `${label} is not available${required ? " (required)" : " (optional)"}.`;
    if (required) fail(message);
    else console.log(`WARN: ${message}`);
    return false;
  }
  info(`${label}: ${result.stdout.split(/\r?\n/)[0]}`);
  return true;
}

function doctor(strictRelease) {
  console.log(`Host: ${process.platform}/${process.arch} (${hostname()})`);
  const checks = [
    toolVersion("Task", "task", ["--version"], true),
    toolVersion("Git", "git", ["--version"], true),
    toolVersion("Node.js", "node", ["--version"], true),
    toolVersion("pnpm", "pnpm", ["--version"], true),
    toolVersion("Cargo", "cargo", ["--version"], true),
    toolVersion("GitHub CLI", "gh", ["--version"], strictRelease),
  ];
  if (checks.some((check) => !check) && process.exitCode) return;
  info(strictRelease ? "Release toolchain is available." : "Local build toolchain is available.");
}

function gitValue(args, description) {
  const result = run("git", args);
  if (!result.ok) {
    fail(`Unable to read ${description}: ${result.stderr || result.stdout}`);
    return null;
  }
  return result.stdout;
}

function preflight(version, { quiet = false } = {}) {
  const config = validateConfig({ quiet: true });
  if (!config) return null;
  if (config.tauri.version !== version) {
    fail(`Requested version ${version} does not match configured version ${config.tauri.version}.`);
    return null;
  }

  const branch = gitValue(["branch", "--show-current"], "the current branch");
  const commit = gitValue(["rev-parse", "HEAD"], "the current commit");
  const status = gitValue(["status", "--porcelain"], "the working-tree status");
  if (branch === null || commit === null || status === null) return null;
  if (branch !== "main" && !branch.startsWith("integration/")) {
    fail(`Release commands require main or integration/*; current branch is ${branch || "detached HEAD"}.`);
    return null;
  }
  if (status.length > 0) {
    fail("Release commands require a clean working tree.");
    return null;
  }
  if (!quiet) {
    info(`Release preflight passed for PulseTalq v${version}.`);
    info(`Source: ${branch} @ ${commit}`);
  }
  return { branch, commit, config };
}

function parsePlatforms(value) {
  const platforms = String(value || "windows")
    .split(",")
    .map((platform) => platform.trim().toLowerCase())
    .filter(Boolean);
  if (platforms.length === 0 || platforms.some((platform) => !RELEASE_PLATFORMS.has(platform))) {
    fail("Platforms must be a comma-separated subset of windows,macos,linux.");
    return null;
  }
  return [...new Set(platforms)];
}

function releaseRoot(version) {
  return join(ROOT, "dist", "releases", `v${version}`);
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function isBundleArtifact(file, platform) {
  const normalized = normalizePath(file).toLowerCase();
  if (!normalized.includes("/bundle/")) return false;
  const extensions = {
    windows: [".exe", ".msi", ".nsis.zip", ".msi.zip", ".sig"],
    macos: [".dmg", ".app.tar.gz", ".sig"],
    linux: [".deb", ".rpm", ".appimage", ".appimage.tar.gz", ".sig"],
  }[platform];
  return extensions.some((extension) => normalized.endsWith(extension));
}

function collect(platform, version) {
  if (!RELEASE_PLATFORMS.has(platform)) {
    fail(`Unsupported platform: ${platform}.`);
    return;
  }
  const config = validateConfig({ quiet: true });
  if (!config) return;
  if (config.tauri.version !== version) {
    fail(`Requested version ${version} does not match configured version ${config.tauri.version}.`);
    return;
  }

  const roots = [join(ROOT, "target"), join(ROOT, "frontend", "src-tauri", "target")];
  const files = [...new Set(roots.flatMap(walkFiles))].filter((file) => isBundleArtifact(file, platform));
  if (files.length === 0) {
    fail(`No ${platform} bundle artifacts were found in a Tauri target/bundle directory.`);
    return;
  }

  const destination = join(releaseRoot(version), platform);
  mkdirSync(destination, { recursive: true });
  const names = new Set();
  for (const file of files) {
    const name = basename(file);
    if (names.has(name)) {
      fail(`Duplicate artifact filename while collecting ${platform}: ${name}`);
      return;
    }
    names.add(name);
    cpSync(file, join(destination, name));
    info(`Collected ${platform}/${name}`);
  }
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function platformArtifacts(root, platform) {
  const directory = join(root, platform);
  return walkFiles(directory).sort((left, right) => left.localeCompare(right));
}

function updaterCandidate(files, platform) {
  const preferences = {
    windows: [".nsis.zip", ".msi.zip"],
    macos: [".app.tar.gz"],
    linux: [".appimage.tar.gz"],
  }[platform];
  for (const extension of preferences) {
    const candidate = files.find((file) => file.toLowerCase().endsWith(extension));
    if (candidate) return candidate;
  }
  return null;
}

function updaterKey(platform) {
  return {
    windows: "windows-x86_64",
    macos: "darwin-aarch64",
    linux: "linux-x86_64",
  }[platform];
}

function assertArtifacts(root, platforms, { requireSignatures }) {
  const byPlatform = {};
  let valid = true;
  for (const platform of platforms) {
    const files = platformArtifacts(root, platform);
    const artifacts = files.filter((file) => !file.toLowerCase().endsWith(".sig"));
    if (artifacts.length === 0) {
      valid = fail(`No staged artifacts found for ${platform}.`);
      continue;
    }
    const candidate = updaterCandidate(files, platform);
    if (!candidate) {
      valid = fail(`No Tauri updater archive found for ${platform}.`);
      continue;
    }
    const signature = `${candidate}.sig`;
    if (requireSignatures && !existsSync(signature)) {
      valid = fail(`Missing updater signature: ${normalizePath(relative(root, signature))}`);
      continue;
    }
    byPlatform[platform] = { files, candidate, signature };
  }
  return valid ? byPlatform : null;
}

function stage(version, platforms) {
  const git = preflight(version, { quiet: true });
  if (!git) return;
  const root = releaseRoot(version);
  const artifacts = assertArtifacts(root, platforms, { requireSignatures: true });
  if (!artifacts) return;

  const repository = process.env.RELEASE_REPOSITORY || DEFAULT_REPOSITORY;
  const nativeFiles = platforms.flatMap((platform) => artifacts[platform].files);
  const artifactRecords = nativeFiles
    .map((file) => ({
      path: normalizePath(relative(root, file)),
      sha256: sha256(file),
      size: statSync(file).size,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  const latest = {
    version,
    notes: `PulseTalq v${version}`,
    pub_date: new Date().toISOString(),
    platforms: {},
  };
  for (const platform of platforms) {
    const { candidate, signature } = artifacts[platform];
    latest.platforms[updaterKey(platform)] = {
      signature: readFileSync(signature, "utf8").trim(),
      url: `https://github.com/${repository}/releases/download/v${version}/${basename(candidate)}`,
    };
  }

  const provenance = {
    schemaVersion: 1,
    product: "PulseTalq",
    version,
    repository,
    branch: git.branch,
    commit: git.commit,
    dirty: false,
    stagedAt: new Date().toISOString(),
    host: { platform: process.platform, arch: process.arch, hostname: hostname() },
    taskVersion: run("task", ["--version"]).stdout,
    nodeVersion: process.version,
    platforms,
    artifacts: artifactRecords,
  };

  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "SHA256SUMS"), `${artifactRecords.map((item) => `${item.sha256}  ${item.path}`).join("\n")}\n`);
  writeFileSync(join(root, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
  writeFileSync(join(root, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);

  const notesPath = join(root, "RELEASE_NOTES.md");
  if (!existsSync(notesPath)) {
    writeFileSync(
      notesPath,
      `# PulseTalq v${version}\n\nSource commit: \`${git.commit}\`\n\nNative platforms: ${platforms.join(", ")}\n`,
    );
  }
  info(`Staged ${artifactRecords.length} signed files for PulseTalq v${version}.`);
}

function inspect(version, platforms) {
  const root = releaseRoot(version);
  let valid = true;
  console.log(`Release directory: ${root}`);
  for (const platform of platforms) {
    const files = platformArtifacts(root, platform);
    if (files.length === 0) valid = fail(`No files found for ${platform}.`);
    else console.log(`${platform}: ${files.map((file) => basename(file)).join(", ")}`);
  }
  for (const name of ["SHA256SUMS", "latest.json", "provenance.json", "RELEASE_NOTES.md"]) {
    if (!existsSync(join(root, name))) valid = fail(`Missing staged metadata: ${name}`);
    else info(`Found ${name}`);
  }
  return valid;
}

function verifyLocal(version, platforms) {
  const root = releaseRoot(version);
  if (!inspect(version, platforms)) return false;
  let valid = true;
  const sums = readFileSync(join(root, "SHA256SUMS"), "utf8").trim().split(/\r?\n/);
  for (const line of sums) {
    const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
    if (!match) {
      valid = fail(`Invalid SHA256SUMS line: ${line}`);
      continue;
    }
    const file = join(root, ...match[2].split("/"));
    if (!existsSync(file)) valid = fail(`Checksummed file is missing: ${match[2]}`);
    else if (sha256(file) !== match[1]) valid = fail(`Checksum mismatch: ${match[2]}`);
  }

  const provenance = readJson(join(root, "provenance.json"));
  const latest = readJson(join(root, "latest.json"));
  if (provenance.product !== "PulseTalq" || provenance.version !== version || provenance.dirty !== false) {
    valid = fail("Provenance product, version, or clean-state receipt is invalid.");
  }
  if (latest.version !== version) valid = fail(`latest.json version is not ${version}.`);
  for (const platform of platforms) {
    if (!latest.platforms?.[updaterKey(platform)]) {
      valid = fail(`latest.json is missing ${updaterKey(platform)}.`);
    }
  }
  if (valid) info(`Local release receipt for PulseTalq v${version} is valid.`);
  return valid;
}

function releaseFiles(root) {
  return walkFiles(root).filter((file) => !file.endsWith(".DS_Store"));
}

function publish(version, confirmation) {
  if (confirmation !== version) {
    fail(`Confirmation must exactly match ${version}.`);
    return;
  }
  const git = preflight(version, { quiet: true });
  if (!git || !verifyLocal(version, readJson(join(releaseRoot(version), "provenance.json")).platforms)) return;
  const auth = run("gh", ["auth", "status"]);
  if (!auth.ok) {
    fail("GitHub CLI is not authenticated. Run gh auth login.");
    return;
  }

  const tag = `v${version}`;
  const root = releaseRoot(version);
  const existing = run("gh", ["release", "view", tag]);
  if (!existing.ok) {
    const created = run("gh", [
      "release", "create", tag,
      "--draft",
      "--title", `PulseTalq ${tag}`,
      "--notes-file", join(root, "RELEASE_NOTES.md"),
      "--target", git.commit,
    ], { inherit: true });
    if (!created.ok) {
      fail(`Unable to create draft release ${tag}.`);
      return;
    }
  }

  const files = releaseFiles(root);
  const uploaded = run("gh", ["release", "upload", tag, ...files, "--clobber"], { inherit: true });
  if (!uploaded.ok) {
    fail(`Unable to upload all assets for ${tag}.`);
    return;
  }
  info(`Draft GitHub Release ${tag} was created or updated. It has not been published.`);
}

function verifyRemote(version) {
  const root = releaseRoot(version);
  if (!existsSync(root)) {
    fail(`Local release directory does not exist: ${root}`);
    return;
  }
  const tag = `v${version}`;
  const result = run("gh", ["release", "view", tag, "--json", "tagName,isDraft,url,targetCommitish,assets"]);
  if (!result.ok) {
    fail(`Unable to read GitHub Release ${tag}: ${result.stderr || result.stdout}`);
    return;
  }
  const release = JSON.parse(result.stdout);
  const remoteNames = new Set((release.assets || []).map((asset) => asset.name));
  const localNames = releaseFiles(root).map((file) => basename(file));
  const missing = localNames.filter((name) => !remoteNames.has(name));
  if (missing.length > 0) {
    fail(`GitHub Release is missing: ${missing.join(", ")}`);
    return;
  }
  info(`${release.url} contains all ${localNames.length} staged assets.`);
  console.log(`Draft: ${release.isDraft}; target: ${release.targetCommitish}`);
}

const [command, ...values] = process.argv.slice(2);
const args = parseArgs(values);

switch (command) {
  case "version":
    currentVersion();
    break;
  case "doctor":
    doctor(Boolean(args["strict-release"]));
    break;
  case "config":
    validateConfig();
    break;
  case "preflight": {
    const version = requireArg(args, "version");
    if (version) preflight(version);
    break;
  }
  case "collect": {
    const platform = requireArg(args, "platform");
    const version = requireArg(args, "version");
    if (platform && version) collect(platform, version);
    break;
  }
  case "stage": {
    const version = requireArg(args, "version");
    const platforms = parsePlatforms(args.platforms);
    if (version && platforms) stage(version, platforms);
    break;
  }
  case "inspect": {
    const version = requireArg(args, "version");
    const platforms = parsePlatforms(args.platforms);
    if (version && platforms) inspect(version, platforms);
    break;
  }
  case "verify-local": {
    const version = requireArg(args, "version");
    const platforms = parsePlatforms(args.platforms);
    if (version && platforms) verifyLocal(version, platforms);
    break;
  }
  case "publish": {
    const version = requireArg(args, "version");
    const confirmation = requireArg(args, "confirm");
    if (version && confirmation) publish(version, confirmation);
    break;
  }
  case "verify-remote": {
    const version = requireArg(args, "version");
    if (version) verifyRemote(version);
    break;
  }
  default:
    fail("Usage: release-tool.mjs <version|doctor|config|preflight|collect|stage|inspect|verify-local|publish|verify-remote>");
}
