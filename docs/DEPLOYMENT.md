# Local deployment with Task

PulseTalq uses [Task](https://taskfile.dev) as its deployment command interface.
GitHub stores source code and published releases. GitHub Actions deployment is
disabled. Any remaining CI workflow is diagnostic only: a local Task run is the
required release gate.

## Install the tools

The approved build host needs:

- Task 3.x
- Git
- Node.js and pnpm
- Rust and Cargo
- the native Tauri prerequisites for its operating system
- GitHub CLI for publication
- platform signing tools when producing signed installers

Confirm the host:

```powershell
task doctor
```

## Local configuration

Copy `.env.deploy.example` to `.env.deploy.local` and add only the variables
required by the host. Git ignores the local file.

```powershell
Copy-Item .env.deploy.example .env.deploy.local
gh auth login
```

Do not paste signing keys into a Task command line. Command lines can enter shell
history and process listings.

## Development validation

Run focused configuration checks while editing Task or release metadata:

```powershell
task validate:config
task validate:taskfiles
```

Run the full local suite before packaging:

```powershell
task validate:local
```

The full suite stops if frontend or Rust checks fail. Missing native libraries
are host setup failures, not verification passes.

## Build a local test installer

On Windows:

```powershell
task package:windows MODE=test
```

On a native macOS host:

```bash
task package:macos MODE=test
```

On a native Linux host:

```bash
task package:linux MODE=test
```

Task refuses a platform task on the wrong operating system. Test packages may be
unsigned and must not be described as production-signed artifacts.

## Prepare a release candidate

Release packaging runs from a clean `integration/*` branch or `main` checkout.
The version must match `frontend/package.json`, `frontend/src-tauri/Cargo.toml`,
and `frontend/src-tauri/tauri.conf.json`.

```powershell
git fetch origin --prune
git status --short --branch
task release:preflight VERSION=0.4.0
task package:windows MODE=release VERSION=0.4.0
```

Each native host places artifacts under:

```text
dist/releases/v0.4.0/windows/
dist/releases/v0.4.0/macos/
dist/releases/v0.4.0/linux/
```

Transfer the native platform directories to the release coordinator through an
approved file transfer. Do not alter filenames or signatures.

## Stage and inspect

For a Windows-only candidate:

```powershell
task release:stage VERSION=0.4.0 PLATFORMS=windows
task release:inspect VERSION=0.4.0 PLATFORMS=windows
task release:verify-local VERSION=0.4.0 PLATFORMS=windows
```

For a complete desktop candidate:

```powershell
task release:stage VERSION=0.4.0 PLATFORMS=windows,macos,linux
task release:inspect VERSION=0.4.0 PLATFORMS=windows,macos,linux
task release:verify-local VERSION=0.4.0 PLATFORMS=windows,macos,linux
```

Staging writes:

- `latest.json` for the Tauri updater;
- `SHA256SUMS` for every published file;
- `provenance.json` with the exact Git and host state;
- `RELEASE_NOTES.md` as the draft release body.

Review these files before publication.

## Publish to GitHub Releases

Publication creates or updates a draft release. The confirmation value must
match the version exactly.

```powershell
task github:publish VERSION=0.4.0 CONFIRM_RELEASE=0.4.0 PLATFORMS=windows
task github:verify VERSION=0.4.0
```

Publishing does not merge branches or promote an integration branch to `main`.
Those remain separate reviewed Git operations.

## Source-code delivery

Agents and humans continue to commit and push source branches normally:

```powershell
git add <owned-files>
git commit -m "type: summary"
git push -u origin <task-branch>
```

Task owns validation, packaging, staging, and release publication. It does not
replace branch review or the multi-agent integration process.

## Rollback

The previous GitHub Actions release definition is stored in
`.github/workflows-disabled/`. To restore it, review its action versions and
secret requirements, move it back to `.github/workflows/` with a `.yml` suffix,
and commit the restoration. Do not enable the old release workflow without first
checking its product identity, signing configuration, and updater destination.
