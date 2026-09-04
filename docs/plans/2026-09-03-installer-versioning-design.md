# Installer versioning design

PulseTalq uses two related versions. The application version is a three-part semantic version such as `0.4.3`. The installer revision is a positive integer attached to the packaged artifact, such as `installer.1`.

The Windows artifact name is:

```text
PulseTalq_0.4.3_installer.1_x64-setup.exe
```

## Version rules

- Increase `MAJOR` for an incompatible product or persisted-data change.
- Increase `MINOR` for a user-facing feature release.
- Increase `PATCH` for an application bug-fix release.
- Increase the installer revision when installer inputs, packaging, bundled assets, metadata, signing, install paths, upgrade behavior, or build automation change.
- Reset the installer revision to `1` when the application version changes.
- Rebuilding the same commit with the same inputs keeps the same installer revision.

The application and Windows product version remains `MAJOR.MINOR.PATCH`. This keeps Cargo, Tauri, MSI, NSIS, and updater comparisons compatible. The installer revision appears in artifact names and build evidence.

## Enforcement

`installer-version.json` records the application version, installer revision, and a SHA-256 fingerprint of installer-sensitive files. The verification command also checks that `frontend/package.json`, `Cargo.toml`, `Cargo.lock`, and `tauri.conf.json` agree on the application version.

```powershell
node scripts/installer-version.mjs verify
node scripts/installer-version.mjs bump
```

The local installer command verifies the fingerprint before compilation and stamps successful bundle filenames afterward. It honors `CARGO_TARGET_DIR`, including an absolute target outside the repository.
