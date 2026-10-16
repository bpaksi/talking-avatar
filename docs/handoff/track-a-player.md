# Handoff: Track A — formats + player slice, first npm release

For Claude Code, run by Bob. Repo: `bpaksi/talking-avatar`, default branch `main`. Package manager: pnpm. Contract: [docs/asset-contract.md](../asset-contract.md).

Goal: ship `@talking-avatar/formats` and `@talking-avatar/player` 0.1.0 early so Bloodtower can install them from npm. `@talking-avatar/cli` is not part of this release.

## Step 1: S2 formats types + validator

- Runs: cloud
- Touches: `packages/formats/**`, `packages/formats/fixtures/keeper/**`
- Work:
  - Zod schemas + TS types for `manifest.json`, `anchor.json`, Rhubarb JSON, per the contract.
  - `validateAvatar(dir)` (Node) applying all contract rules; returns a list of errors with file and `line_id`.
  - Fixture set: the Keeper folder in contract layout (small placeholder or real files). Add negative fixtures: missing letter, missing file, duplicate `line_id`, anchor out of range, bad cue letter, non-monotonic cues.
- Acceptance:
  - `pnpm check` green.
  - Keeper fixture validates with zero errors.
  - Each negative fixture fails with the expected rule and names the file.

## Step 2: thin S5 player

- Runs: cloud
- Touches: `packages/player/**`
- Work: `<TalkingAvatar manifest={...} lineId="ts-keeper-001" onEnd={() => {}} />`
  - Plays the line's `.m4a` in an `<audio>` element.
  - Per frame (requestAnimationFrame), samples `audio.currentTime`, binary-searches the latest cue at or before it, shows that letter's mouth. `REST` before the first cue and after end.
  - Mouth drawn over the portrait in the anchor box (fractions → % positioning), so it scales with the portrait.
  - Preloads all mouth images; no network calls during playback beyond the audio.
  - Basic caption: line `text` with `[pause N]` stripped. Themes later (`captionTheme` ignored for now).
  - Calls `onEnd` when audio ends.
  - Resolves paths relative to a base URL (prop `baseUrl`, e.g. `/avatars/keeper/`).
- Acceptance:
  - Unit tests for cue lookup (start, between cues, seek, after end).
  - Example page plays the Keeper fixture with synced mouths in desktop Safari and iPad Safari (audio starts from a user tap).
  - `pnpm check` green.

## Step 3: package prep for 0.1.0

- Runs: cloud
- Touches: `packages/formats/package.json`, `packages/player/package.json`, `CHANGELOG.md`, `README.md`
- Work: set `version` to `0.1.0` in both; confirm `files`, `exports`, `types`, `publishConfig.access: "public"`, `LICENSE` copy; `react` as a peer dependency of the player. Leave `@talking-avatar/cli` at `0.0.0` (or `"private": true` for now) so it does not publish.
- Acceptance: `pnpm -r --filter "./packages/formats" --filter "./packages/player" pack` produces tarballs containing `dist` and `LICENSE`; `pnpm check` green; PR merged to `main`.

## Step 4: first publish by hand

- Runs: local (Bob's Mac; needs 2FA)
- Work:

```sh
git checkout main && git pull
pnpm install --frozen-lockfile
pnpm check && pnpm -r run build
npm login                       # npm org: talking-avatar, 2FA prompt
cd packages/formats && pnpm publish --access public
cd ../player && pnpm publish --access public
git tag v0.1.0 && git push origin v0.1.0
```

- Acceptance: `npm view @talking-avatar/formats@0.1.0` and `npm view @talking-avatar/player@0.1.0` resolve; a scratch project can `pnpm add @talking-avatar/player@0.1.0`.
- Note: the tag push must not trigger a second publish. Either add the release workflow after this step, or have it skip versions already on npm.

## Step 5: npm trusted publishing

- Runs: local (npmjs.com, Bob)
- Work: on npmjs.com, for each of `@talking-avatar/formats` and `@talking-avatar/player`: Settings → Trusted publisher → GitHub Actions, repository `bpaksi/talking-avatar`, workflow `release.yml`. Then set publishing access to require 2FA and disallow tokens.
- Acceptance: both packages show the trusted publisher. No `NPM_TOKEN` secret exists in the repo.

## Step 6: release workflow (OIDC, provenance)

- Runs: cloud
- Touches: `.github/workflows/release.yml`
- Outline:

```yaml
name: release
on:
  push:
    tags: ["v[0-9]*"]
permissions:
  contents: read
  id-token: write          # OIDC for trusted publishing + provenance
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check tag is semver
        run: '[[ "$GITHUB_REF_NAME" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$ ]]'
      - uses: pnpm/action-setup@v4
        with: { version: 10.33.4 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, registry-url: "https://registry.npmjs.org" }
      - run: npm install -g npm@latest   # trusted publishing needs npm >= 11.5
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
      - run: pnpm -r run build
      - name: Versions match tag
        run: node scripts/check-versions.mjs "${GITHUB_REF_NAME#v}"
      - run: pnpm -r --filter "./packages/*" publish --provenance --access public --no-git-checks
```

  No `NPM_TOKEN` / `NODE_AUTH_TOKEN`. Private or `0.0.0` packages are skipped.
- Acceptance: a `v0.1.1` (or prerelease) tag publishes via OIDC with a provenance badge on npm; a non-semver tag fails the check step.

Update P1 S7 acceptance (which names `NPM_TOKEN`) to trusted publishing when this lands.
