# Windows installer receipt, 2026-09-03

Status: local test package

## Included work

| Branch | Included commit | Result |
|---|---:|---|
| `feature/installer-deep-focus` | `680a8ab` | Included through the release base. |
| `feature/windows-dictation-v1` | `6e93b8f` | Included through the release base. |
| `feature/PT-2026-09-03-dictation-ui` | `fa084b6` | Included through the installer update branch. |
| `feature/dictation-ux-refinement` | `b4a59c4` | Included. This is the verified shortcut, overlay, settings, navigation, and installer shortcut implementation. |
| `docs/PT-2026-09-02-license-ip` | `bcb207e` | Included. Its two licensing commits were replayed on the newer candidate, then branch ancestry was recorded. |
| `fix/PT-2026-09-02-logo-home` | `b5d5852` | Included by ancestry. The later dictation refinement supplies the same Home routing with newer navigation behavior. |
| `docs/PT-2026-09-02-ui-modernization-scope` | `10af08f` | Included. |
| `chore/taskfile-deployment` | `3de96e4` | Included. |
| `chore/PT-2026-09-03-installer-update` | `9c8ad99` | Included. |

All listed completed local task branches are ancestors of the release candidate. No completed local task branch was deferred.

Remote branches inherited from the upstream Meetily repository were not classified as completed PulseTalq tasks. They remain outside this release unless a PulseTalq task imports and verifies them.

## Verification contract

- `python scripts/verify-installer-assets.py`: passed, 20 checks, 5 accepted scaffold warnings.
- `node --test frontend/tests/lib/dictation-shortcut.test.mjs`: passed.
- `pnpm run build`: passed.
- `powershell.exe -File scripts/verify-installer-branding.ps1 -Path <installer>`: passed, 3 checks.
- LLVM 18.1.8 portable package checksum: `94af030060d88cc17e9f00ef1663ebdc1126b35e16bebdfa1e807984b70abd8f`.

## Package

- Platform: Windows x64
- Version: 0.4.0
- Format: NSIS setup executable
- Build command: `pnpm --dir frontend tauri:build:windows-local`
- Signing state: unsigned local test build. `DIGICERT_KEYPAIR_ALIAS` was not set.
- Packaged commit: `796f70d98ac4a0fd464ed7ab98394bbfb07c88ed`
- Artifact path: `dist/releases/v0.4.0/windows/PulseTalq_0.4.0_x64-setup.exe`
- Byte size: `42897619`
- SHA-256: `b8d766ad7457efa6f9fe4a51bb8f709e89e40ed865a415e2b8c75abe642f98f9`
