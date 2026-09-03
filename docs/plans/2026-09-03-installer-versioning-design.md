# Installer versioning design

PulseTalq uses two related versions. The application version remains a three-part semantic version such as `0.4.0`. The installer revision is a positive integer attached to the packaged artifact, such as `installer.1`.

The full Windows artifact name is:

```text
PulseTalq_0.4.0_installer.1_x64-setup.exe
```

## Version rules

- Increase `MAJOR` for an incompatible product or persisted-data change.
- Increase `MINOR` for a user-facing feature release.
- Increase `PATCH` for an application bug-fix release.
- Increase the installer revision for every change to installer inputs, packaging behavior, bundled assets, metadata, signing, install paths, upgrade behavior, or installer build automation.
- Reset the installer revision to `1` when the application version changes.
- Rebuilding the same commit with the same inputs keeps the same installer revision.

The internal application and Windows product version remains `MAJOR.MINOR.PATCH`. This preserves compatibility with Cargo, Tauri, MSI, and updater version comparisons. The installer revision appears in artifact names, build evidence, and release metadata.

## Enforcement

`installer-version.json` records the application version, installer revision, and a SHA-256 fingerprint of installer-sensitive files. `node scripts/installer-version.mjs verify` fails when those inputs change without a revision update. The only normal update command is:

```powershell
node scripts/installer-version.mjs bump
```

The local installer build verifies the fingerprint before compilation and stamps successful bundle filenames afterward.
