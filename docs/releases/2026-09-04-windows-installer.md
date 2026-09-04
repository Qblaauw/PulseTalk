# PulseTalq 0.4.3 Windows installer receipt

## Correct artifact

- File: `F:\ptbuild\pulsetalq-20260904\release\bundle\nsis\PulseTalq_0.4.3_installer.1_x64-setup.exe`
- Size: 42,704,653 bytes
- SHA-256: `ffd9df3572523260d6b35c7b3463cd3bd1363f64f96e32e8ee4e19d57ff70ca2`
- Target: Windows x64, NSIS, CPU inference profile
- Product version: `0.4.3`
- Installer revision: `1`
- Signing state: unsigned. `Get-AuthenticodeSignature` returned `NotSigned`.
- Created at: `2026-09-04T17:20:56Z`

## Correction

The first artifact from this task used product version `0.4.0`. The installed PulseTalq app already reports `0.4.2`, so that package could not replace it. The wrong artifact was moved out of the normal bundle folder and renamed to:

```text
F:\ptbuild\pulsetalq-20260904\superseded\PulseTalq_0.4.0_x64-setup.SUPERSEDED.exe
```

The corrected package uses `0.4.3`, one patch version above the installed app. Its generated NSIS script sets `PRODUCTNAME` to `PulseTalq`, `VERSION` to `0.4.3`, and writes `DisplayVersion=0.4.3` to the existing PulseTalq uninstall key.

## Provenance

- Product base: `integration/pulsetalq-next` at `436adc672a04b2a57d51784913c5beebe5e7c2d8`
- Build branch: `release/PT-2026-09-04-windows-installer`
- Corrected build commit: `c61a1f625d00154a5ba4076038f6c3428eeb0732`
- The build commit adds the `0.4.3` version correction and installer revision guard to the redesigned integration source.
- The task worktree was clean at the corrected build commit before packaging.

## Build

The installer was produced with:

```powershell
$env:LIBCLANG_PATH = 'C:\Users\qblaa\AppData\Roaming\Python\Python313\site-packages\clang\native'
$env:CARGO_TARGET_DIR = 'F:\ptbuild\pulsetalq-20260904'
pnpm run tauri:build:windows-local
```

The command first verified `0.4.3_installer.1`, built the app, then stamped the completed NSIS filename. The explicit Cargo target path keeps MSBuild output outside the Windows Temp directory and below legacy path-length limits. The build used LLVM/libclang 18.1.1, Rust 1.98.0, Tauri CLI 2.11.1, Node 22.14.0, and pnpm 9.15.9.

## Verification

- The installed app inspection found `PulseTalq 0.4.2` at `C:\Users\qblaa\AppData\Local\PulseTalq\pulse-talq.exe` before the corrected build.
- The stale installer manifest test failed before the bump because it recorded `0.4.2` while all source manifests recorded `0.4.3`.
- `node scripts/installer-version.mjs verify`: pass before and after packaging with `0.4.3_installer.1`.
- `pnpm install --frozen-lockfile`: pass with the lockfile unchanged.
- `pnpm run lint`: pass with existing React hook warnings and no errors.
- `node --test frontend/scripts/prepare-sidecars.test.js`: pass, 6 tests.
- `python scripts/verify-installer-assets.py`: pass, 20 checks, 0 failures, 5 warnings for unused Next.js starter SVGs.
- `pnpm run tauri:build:windows-local`: pass at `c61a1f625d00154a5ba4076038f6c3428eeb0732`.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-installer-branding.ps1 -Path <correct-artifact>`: pass, 3 checks, 0 failures, 0 warnings.
- `pnpm run sidecars:check`: pass. llama-helper and FFmpeg are x86_64 PE executables.
- Installer resources: `ProductName=PulseTalq`, `ProductVersion=0.4.3`, `FileVersion=0.4.3`, `FileDescription=PulseTalq`.
- Packaged app resources: `ProductName=PulseTalq`, `ProductVersion=0.4.3`, `FileVersion=0.4.3`, `FileDescription=PulseTalq`.
- Packaged app SHA-256: `ac97539ea19cff3162f187fc2a404e35e00df585921ee1f6775a0ae12ecf30fc`.
- The exported frontend contains the redesigned Account, Library, Home, meeting review, and Settings markers, plus the visible `v0.4.3` label. No visible `0.4.0`, `0.4.1`, or `0.4.2` marker remains in the exported app.
- No task-owned build process remained after packaging.

## Limits

The corrected installer was not launched. Registry, Start menu, and runtime checks after installation remain unrun. The artifact is unsigned because `DIGICERT_KEYPAIR_ALIAS` was not configured, so Windows SmartScreen can warn when it is opened.
