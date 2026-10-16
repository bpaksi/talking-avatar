# Releasing

`@talking-avatar/formats` and `@talking-avatar/player` publish to npm. `@talking-avatar/cli` stays private.

0.1.0 was published by hand. Later versions use npm trusted publishing (GitHub Actions OIDC, workflow `release.yml`, no environment, no `NPM_TOKEN`).

1. Bump `version` in `packages/formats/package.json` and `packages/player/package.json` to the same semver (do not publish from `workspace:*` — the release job packs first so pnpm rewrites that to the real formats version).
2. Merge to `main`.
3. Run the **Release** workflow (`Actions` → `release` → `Run workflow`).

The first OIDC publish is untested until that run succeeds.
