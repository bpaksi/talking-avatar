# Handoff: Track B — Keeper in Bloodtower

For Claude Code. Repo: `bpaksi/DarkTower` (monorepo), app `apps/bloodtower` (Next.js/React, port 4787). Board at `/board`; iPads at `/join` and `/device`. Target: iPad Safari only.

Contract: [talking-avatar docs/asset-contract.md](https://github.com/bpaksi/talking-avatar/blob/main/docs/asset-contract.md).

**Dependency rule:** Bloodtower waits for `@talking-avatar/player@0.1.0` on npm. No `pnpm link`, no `file:` or git dependency.

## Step 1: serve avatars as static assets

- Runs: cloud
- Touches: `apps/bloodtower/public/avatars/keeper/**`
- Work: copy the Keeper folder in contract layout (manifest, portrait, anchor, `mouths/`, `lines/*.m4a` + `*.json`). No `masters/` or `.wav`.
- Acceptance: `http://localhost:4787/avatars/keeper/manifest.json` and every file it references return 200.

## Step 2: scene hook

- Runs: cloud
- Touches: Bloodtower scene/story code
- Work: a story moment can name a speaker and line: `{ speaker: "keeper", lineId: "ts-keeper-001" }`. A hook (e.g. `useSpeakingMoment()`) exposes the current `{ speaker, lineId }` to the board and clears it on end. Board loads `/avatars/<speaker>/manifest.json`.
- Acceptance: unit test that a moment with speaker + `lineId` sets the hook state and an end event clears it; unknown `lineId` is rejected against the manifest.

## Step 3: hard-wire one Keeper moment

- Runs: cloud
- Touches: `/board` page
- Work: one Keeper moment that plays `ts-keeper-001`, `-002`, `-003` in order. Until the package ships, render a placeholder (portrait + caption text) behind the same props `TalkingAvatar` will take: `manifest`, `lineId`, `onEnd`. Audio starts from a tap (iPad Safari autoplay rules).
- Acceptance: on `/board`, the moment advances through the 3 lines with captions; works against the Keeper fixture files.

## Step 4: wire in the package (after 0.1.0 publishes)

- Runs: cloud
- Work:

```sh
pnpm --filter bloodtower add @talking-avatar/player@0.1.0
```

  Replace the placeholder with `<TalkingAvatar manifest={m} lineId={id} onEnd={next} />`. Pin the exact version.
- Acceptance: `pnpm-lock.yaml` resolves the package from the npm registry; app builds.

## Step 5: device check

- Runs: local (Bob, iPad)
- Acceptance: the Keeper speaks all 3 lines with synced mouths on `/board` in iPad Safari; mouth stays aligned with the portrait at board size; no console errors.
