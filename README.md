# talking-avatar

Story-neutral tool that turns a tagged script and a cast (voice provider + voice ID, portrait, an 8-shape mouth kit, one shared anchor) into lip-synced lines: `line.json` for live playback with `<TalkingAvatar>`, or MP4.

Status: 0.1.0 of [`@talking-avatar/formats`](packages/formats/README.md) (schemas and the character folder validator) and [`@talking-avatar/player`](packages/player/README.md) (`<TalkingAvatar>`), built on [asset contract v1](docs/asset-contract.md). `@talking-avatar/cli` is not published yet. See `docs/sdlc.md`, `docs/lip-sync-best-practices.md`, `plans/` and [CHANGELOG.md](CHANGELOG.md).

```sh
pnpm add @talking-avatar/formats@0.1.0 @talking-avatar/player@0.1.0
```

Package manager: pnpm. `pnpm check` runs lint, typecheck, and tests. To release: bump `formats` and `player` to the same version, merge to `main`, and run the Release workflow. See [docs/releasing.md](docs/releasing.md). License: MIT.
