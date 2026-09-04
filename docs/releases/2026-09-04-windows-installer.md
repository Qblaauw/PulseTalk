# PulseTalq 0.4.0 Windows installer receipt

## Artifact

- File: `F:\ptbuild\pulsetalq-20260904\release\bundle\nsis\PulseTalq_0.4.0_x64-setup.exe`
- Size: 42,692,430 bytes
- SHA-256: `ad1f46056222468b3cb1a494a2baa839a2c6845f4d1f7d760a64d406f02131d8`
- Target: Windows x64, NSIS, CPU inference profile
- Product version: `0.4.0`
- Signing state: unsigned (`Get-AuthenticodeSignature` returned `NotSigned`)
- Created at: `2026-09-04T15:28:30.1243140Z`

## Provenance

- Product source: `integration/pulsetalq-next` at `436adc672a04b2a57d51784913c5beebe5e7c2d8`
- Build branch: `release/PT-2026-09-04-windows-installer`
- Build commit: `9a9190af967bc2d60f6a654c12e74785adba69da`
- Source difference from the integration SHA at build time: only `project/state/tasks/PT-2026-09-04-windows-installer.json`
- Build worktree was clean at the build commit before packaging.

## Build

The installer was produced with:

```powershell
$env:LIBCLANG_PATH = 'C:\Users\qblaa\AppData\Roaming\Python\Python313\site-packages\clang\native'
$env:CARGO_TARGET_DIR = 'F:\ptbuild\pulsetalq-20260904'
pnpm run tauri:build:windows-local
```

The explicit Cargo target path keeps MSBuild output outside the Windows Temp directory and below legacy path-length limits. The build used LLVM/libclang 18.1.1, Rust 1.98.0, Tauri CLI 2.11.1, Node 22.14.0, and the repository's pinned pnpm 9.15.9. Tauri built one NSIS bundle successfully. The pinned FFmpeg archive and extracted executable were hash-verified before use.

## Verification

- `python scripts/verify-installer-assets.py`: pass, 20 checks, 0 failures, 5 warnings for unused Next.js starter SVGs.
- `pnpm install --frozen-lockfile`: pass with the lockfile unchanged.
- `pnpm run tauri:build:windows-local`: pass with the environment shown above.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-installer-branding.ps1 -Path <artifact>`: pass, 3 checks, 0 failures, 0 warnings.
- `pnpm run sidecars:check`: pass; llama-helper and FFmpeg are x86_64 PE executables.
- Installer version resources: `ProductName=PulseTalq`, `ProductVersion=0.4.0`, `FileDescription=PulseTalq`.
- SHA-256 was read twice after the build and remained unchanged.
- No task-owned build process remained after packaging.
- `git diff --check 436adc672a04b2a57d51784913c5beebe5e7c2d8..9a9190af967bc2d60f6a654c12e74785adba69da`: pass.

## Limits

The installer was not launched or installed during this build. Registry, Start menu, upgrade, and application smoke checks that require installation remain unrun. The artifact is unsigned because `DIGICERT_KEYPAIR_ALIAS` was not configured, so Windows SmartScreen can warn when it is opened.
