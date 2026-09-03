# Task-based local deployment design

## Decision

PulseTalq will use Task as the single command interface for validation,
packaging, release staging, and publication. GitHub remains the Git remote and
release host. GitHub Actions will not sign, package, or publish the application
during this phase and is not release authority. Existing manual CI may remain
as diagnostic visibility, but local Task validation is mandatory.

The executable release workflow will move out of `.github/workflows/`. Its
preserved file remains available as a migration reference but GitHub will not
discover it as a workflow.

## Goals

- Run the same named validation and release gates from human and agent sessions.
- Require local checks before packaging or publication.
- Build each desktop package on its native operating system.
- Keep signing credentials on approved local build hosts.
- Tie every staged and published artifact to an exact Git commit.
- Continue committing and pushing source code to GitHub.
- Publish release artifacts to GitHub Releases with the local `gh` CLI.
- Produce checksums, updater metadata, and a machine-readable provenance record.

## Non-goals

- Replacing GitHub as the source repository or release download host.
- Cross-compiling macOS packages on Windows.
- Automatically attaching macOS or Linux build hosts in the first pass.
- Publishing a production release while the deployment system itself is under
  review.

## Command structure

```text
Taskfile.yml
└── .taskfiles/
    ├── doctor.yml
    ├── validate.yml
    ├── build.yml
    ├── package.yml
    ├── release.yml
    └── github.yml
```

The root Taskfile only defines shared settings and includes. Each included file
owns one part of the lifecycle.

```text
task doctor
  -> tool and host capability report

task validate:local
  -> config, frontend, and Rust checks

task package:windows MODE=test
  -> unsigned native Windows package for local acceptance

task package:windows MODE=release VERSION=x.y.z
  -> strict release preflight, native package, artifact collection

task release:stage VERSION=x.y.z
  -> checksums, updater manifest, release notes, provenance

task release:inspect VERSION=x.y.z
  -> read-only staged release report

task github:publish VERSION=x.y.z CONFIRM_RELEASE=x.y.z
  -> draft GitHub Release and artifact upload

task github:verify VERSION=x.y.z
  -> compare the published release with the staged receipt
```

## Platform model

Windows packaging is operational first because the current approved host is
Windows. macOS and Linux use the same task names and release directory contract,
but their tasks require native hosts.

```text
Windows host -> dist/releases/vX/windows/
macOS host   -> dist/releases/vX/macos/
Linux host   -> dist/releases/vX/linux/
coordinator  -> dist/releases/vX/{metadata and all platform artifacts}
```

The coordinator may receive native artifacts through an approved file transfer
or shared release directory. Artifact collection never treats a GitHub Actions
artifact as authoritative.

## Release safety

Publication fails unless all required conditions hold:

- Task runs from `main` or the approved `integration/*` branch.
- The worktree is clean.
- The requested version matches Tauri, Cargo, and frontend metadata.
- PulseTalq product name, bundle identifier, icons, and updater endpoint pass.
- Required artifacts and updater signatures exist for the selected platforms.
- `SHA256SUMS`, `latest.json`, and `provenance.json` describe the same files.
- The provenance record contains the branch, commit SHA, dirty state, host OS,
  Task version, Node version, and staging time.
- `gh auth status` succeeds.
- `CONFIRM_RELEASE` exactly matches the version being published.

Test packages may be unsigned. Release packages declare platform-signing and
Tauri updater-signing status separately. A release cannot imply that an unsigned
installer is signed.

## Secrets

Local deployment variables load from `.env.deploy.local`, which Git ignores.
The repository contains only `.env.deploy.example`. Signing keys and API
credentials must never enter Task output, release metadata, or committed files;
the native signing tools report missing credentials during release packaging.

## GitHub Actions retirement

The cutover moves the executable release workflow to
`.github/workflows-disabled/` with a `.disabled` suffix. A README in
`.github/workflows/` points operators to Task. Non-deploy CI can remain for
diagnostics, but cannot publish a release. Restoring deployment requires a
reviewed change that moves it back and documents why local Task execution no
longer meets the requirement.

## Verification

This change is ready for review when:

- `task --list` loads every included Taskfile.
- `task doctor` reports the current host and tools without exposing secrets.
- `task validate:config` passes.
- `task release:preflight` rejects a dirty tree or invalid release branch.
- `task release:inspect` reports missing artifacts without publishing anything.
- the former release workflow YAML is outside `.github/workflows/`;
- remaining CI workflows cannot publish releases and are not release gates.
- documentation describes local build, stage, publish, verify, and rollback.
- no production release command runs during implementation verification.

## Rollback

Task deployment is reversible. Move the release workflow back into
`.github/workflows/`, review its secrets and action versions, and commit the
restoration. The disabled workflow is preserved specifically for that recovery
path.

**Created:** 2026-09-02 . **Last opened:** 2026-09-02 . **Last edited:** 2026-09-02 . **Status:** stable . **Owner:** Q. Blaauw
