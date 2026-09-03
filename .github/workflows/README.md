# GitHub Actions deployment disabled

PulseTalq builds, tests, packages, and publishes releases from the repository
Taskfile. GitHub remains the Git remote and release host, but GitHub Actions is
not part of the active deployment path. Existing manually triggered CI files
remain available for diagnostics; they are not release authority and do not
replace the required local Task checks.

Run from an approved local build host:

```text
task doctor
task validate:local
task package:current MODE=test
task release:stage VERSION=x.y.z
task github:publish VERSION=x.y.z CONFIRM_RELEASE=x.y.z
```

The previous release workflow is preserved under `.github/workflows-disabled/`
with a `.disabled` suffix. GitHub does not discover it as an executable workflow.

See `docs/DEPLOYMENT.md` for the full release procedure and rollback path.
