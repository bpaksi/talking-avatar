# @talking-avatar/formats

Schemas, types and helpers for talking-avatar files. MIT license.

```sh
pnpm add @talking-avatar/formats@0.1.0
```

## Character folders (asset contract v2)

[docs/asset-contract.md](https://github.com/bpaksi/talking-avatar/blob/main/docs/asset-contract.md) defines the folder: `manifest.json`, `portrait.webp` (or `.png`), `anchor.json`, `mouths/*.webp` (or `.png`), and `lines/<line_id>.m4a` plus Rhubarb `lines/<line_id>.json`. The validator reads size and alpha from both PNG and WebP (`readImageInfo`, `readPngInfo`, `readWebpInfo`).

```ts
// Browser-safe: schemas and types.
import { avatarManifestSchema, type AvatarManifest } from "@talking-avatar/formats";

const manifest: AvatarManifest = avatarManifestSchema.parse(await (await fetch("/avatars/keeper/manifest.json")).json());
```

```ts
// Node: check a folder against contract rules 1–10.
import { validateAvatar } from "@talking-avatar/formats/node";

const issues = await validateAvatar("public/avatars/keeper");
// [{ rule: 8, file: "mouths/AH.png", message: "frame mouth is 128x160; …" }]
```

Each issue has `rule` (1–10, or `"schema"` for an unreadable or misshapen file), `file` (relative to the folder), `lineId` when it concerns one line, and `message`. An empty list means the folder is valid.

## Fixtures

`fixtures/keeper` is a complete placeholder character (generated art and `say` voice, timing derived from loudness, not Rhubarb). `fixtures/minimal` and `fixtures/invalid/<case>` are tiny folders for the validator tests. Regenerate them with `node packages/formats/scripts/make-fixtures.mjs` (macOS for the Keeper's audio; `--skip-audio` keeps it).
