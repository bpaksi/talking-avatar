# P1 plan: talking-avatar v0.1.0

Status: **draft — awaiting maintainer approval (G0)**

## Goal

A story-neutral tool that turns a script of lines into speaking-character assets: voiced audio, mouth-shape cue tracks and word timings per line, plus a React component that plays them and an optional MP4 render.

Scripts, art and voices always live in the **consuming project**, never in this repo. This repo ships only tiny generic example assets (or generated placeholders) for tests and docs, using neutral example characters such as `narrator` and `guide`. Nothing is copied from any earlier demo.

Background and rationale for the mouth set, timing and playback rules: [docs/lip-sync-best-practices.md](../docs/lip-sync-best-practices.md).

## Settled decisions (G0 answers)

- **License:** MIT. The repo has a `LICENSE` file (copyright `talking-avatar contributors`, 2026) and every `package.json` sets `"license": "MIT"`.
- **Distribution:** releases are published to **npm**; consumers install from npm at an exact version.
- **TTS failure:** no fallback provider and no backup voice. If synthesis fails, or the audio is missing at play time, the component shows the **caption only**.

## Pipeline

```text
generate (TTS) --> time (Rhubarb + whisper) --> play (<SpeakingAvatar>)
\_______ cached by line_id, ahead of time ______/
```

Generate and time run **ahead of time** in `pnpm talk build` and are cached by `line_id`. Playback only reads finished files, so it **never waits on a network call**.

## CLI

```sh
pnpm talk build <script.yaml> --cast <cast.yaml> [--mp4]
```

Per line:

1. **Generate (TTS)** with the speaker’s configured provider and voice ID (see *TTS providers*). The style/delivery instruction is passed as its **own field** to the provider, never concatenated into the spoken text (a previous bug read the instruction aloud). A test asserts the request text equals the line text.
2. **Time (Rhubarb Lip Sync)** on the generated audio, with the line’s script text passed as a dialog hint (`--dialogFile`) and `--exportFormat json`. The **audio is the timing authority**: cue times come from the audio, never from text length estimates. Rhubarb’s shapes are mapped to the 8-shape kit (see *Mouth set*), producing a cue track `[{time, shape}]`.
3. **Overrides:** if the line has an overrides file, its cues are merged on top of the Rhubarb track (see *Timing*).
4. **faster-whisper** word timings for captions.
5. Writes one `line.json`: audio file path, cue track `[{time, shape}]`, word timings `[{word, start, end}]`.

**Cache:** keyed by `line_id`, storing a hash of text + speaker voice config (provider, voice ID, style) + art; unchanged lines are not re-synthesised or re-timed. Changing an overrides file re-runs only the merge. **Line ids are stable** and never change or get reused.

**Pre-flight checks (before any paid API call):**

- missing mouth image for a speaker (any of the 8 required shapes);
- untagged or unknown speaker;
- unknown voice provider, or a speaker with no voice ID;
- line estimated longer than 20 s;
- invalid mouth kit: all mouth images must be the same size, have transparency, and be registered to the speaker’s shared anchor.

## TTS providers

TTS is a **parameter**, not a hard-wired service. Each speaker in `cast.yaml` names its `provider` and `voiceId`. Providers sit behind a small plugin interface:

```ts
interface TtsProvider {
  id: string; // e.g. "gemini"
  synthesize(req: { text: string; voiceId: string; style?: string }): Promise<{ audio: Uint8Array; format: "wav" | "ogg" }>;
}
```

Switching a speaker to another provider is a **config change** only. v0.1.0 ships one real provider (Gemini TTS) plus a fake for tests. There is **no automatic failover**: a failed synthesis is reported for that line, and at play time that line shows its caption only.

## Mouth set

An **8-shape starting set**, mapped from Rhubarb Lip Sync’s shapes (A–H plus X, per the [Rhubarb README](https://github.com/DanielSWolf/rhubarb-lip-sync#mouth-shapes)):

| Shape | Rhubarb | Sounds |
| --- | --- | --- |
| `REST` | X | silence, pauses, idle |
| `MBP` | A | M, B, P |
| `CONS/EE` | B | most consonants (K, S, T, D, N…), EE as in *bee* |
| `EH/AE` | C | EH as in *men*, AE as in *bat* |
| `AH` | D | AA as in *father* |
| `OH/ER` | E | AO as in *off*, ER as in *bird* |
| `OO/W` | F | UW as in *you*, OW as in *show*, W as in *way* |
| `FV` | G | F, V |

**Optional extensions**, added only when testing shows a real gap:

- `L` — Rhubarb H (long L, tongue behind upper teeth). Until a kit has `L`, H maps to `EH/AE`.
- `TH` — Rhubarb has no TH shape; Rhubarb times TH as B, so `TH` is placed via overrides. Without it, TH stays `CONS/EE`.

Rhubarb is run with `--extendedShapes GX` by default (`GHX` when the kit has `L`).

All mouth images are drawn on the **same head** and registered to **one shared anchor** per speaker, so swaps never jitter.

### Art-kit spec

Every speaker’s kit provides these images, all the same pixel size, transparent background, positioned on the shared anchor:

| Shape | Sounds | Visual pose |
| --- | --- | --- |
| `REST` | silence | lips closed and relaxed; the idle mouth used when not speaking |
| `MBP` | M, B, P | lips closed with slight pressure, a touch firmer than `REST` |
| `CONS/EE` | K, S, T, D, N, EE | slightly open, teeth clenched or nearly together, lips a little wide |
| `EH/AE` | EH, AE | mouth open, medium; also the in-between from closed to `AH` |
| `AH` | AA | wide open, jaw dropped |
| `OH/ER` | AO, ER | slightly rounded, no wider open than `EH/AE`; in-between towards `OO/W` |
| `OO/W` | UW, OW, W | puckered, small rounded lips |
| `FV` | F, V | upper teeth resting on the lower lip |
| `L` *(optional)* | long L | open between `EH/AE` and `AH`, tongue tip visible behind upper teeth |
| `TH` *(optional)* | TH | slightly open, tongue tip visible between the teeth |

## Timing

- The **recorded or generated audio is the timing authority**.
- Rhubarb (with the script text as a hint) produces the cue track `[{time, shape}]` as JSON.
- **Overrides:** artists can override any cue through a per-line overrides file (`<line_id>.overrides.json`, same `[{time, shape}]` format, optionally with a `remove` list of cue times). It is merged on top of the Rhubarb track: an override at the same time replaces the cue, new times are inserted, and the result is re-sorted by time.
- **Anticipation:** `MBP` closure and `OO/W` rounding land slightly **before** the sound (the lips get there first). The build applies a small configurable lead (default ~1–2 frames) to those shapes when Rhubarb has not already anticipated them; overrides win.

## Formats

`cast.yaml` (per character):

```yaml
narrator:
  voice: { provider: gemini, voiceId: <voice-id>, style: "calm, warm" }
  portrait: art/narrator.png
  mouths:
    REST: m/rest.png
    MBP: m/mbp.png
    CONS/EE: m/cons-ee.png
    EH/AE: m/eh-ae.png
    AH: m/ah.png
    OH/ER: m/oh-er.png
    OO/W: m/oo-w.png
    FV: m/fv.png
    # optional: L, TH
  anchor: { x: 120, y: 210 }
```

`script.yaml`:

```yaml
id: intro
lines:
  - id: intro-001
    speaker: guide
    note: "optional direction for humans"
    text: "Welcome. [pause 0.5] Follow me."
```

`line.json`:

```json
{
  "lineId": "intro-001",
  "audio": "audio/intro-001.wav",
  "cues": [{ "time": 0.0, "shape": "REST" }, { "time": 0.05, "shape": "EH/AE" }],
  "words": [{ "word": "Welcome", "start": 0.05, "end": 0.6 }]
}
```

`[pause N]` inserts N seconds of silence. All formats (cast, script, overrides, line.json) are validated with Zod schemas.

## Player

`<SpeakingAvatar line={lineJson} cast={...} />` plays a `line.json`:

- **Master clock:** the audio element’s `currentTime`. On each frame it **binary-searches** the cue track for the latest cue at or before `currentTime` and shows that shape. It **never uses a free-running animation timer**, so pause, seek, buffering and playback-rate changes stay in sync.
- Shows word-by-word captions driven by the same clock.
- If the audio is missing or fails to load, shows the **caption only** (mouth stays `REST`); no fallback voice.
- Respects `prefers-reduced-motion` (no mouth animation; captions still shown).

## `--mp4`

Renders the component via Playwright and muxes with FFmpeg, for sharing and trailers.

## Distribution

Published to **npm**; consumers install from npm at an exact version. Package name is **TBD**: suggest `talking-avatar` or a scoped name (e.g. `@talking-avatar/cli`, `@talking-avatar/player`, `@talking-avatar/formats`). Availability must be checked on npm before S7.

Release workflow (`.github/workflows/release.yml`): on a pushed version tag `v*`, GitHub Actions runs `pnpm check`, then `pnpm publish --provenance --access public` using the `NPM_TOKEN` repository secret (to be added by the maintainer) and `id-token: write` permission for npm provenance.

## Stack

- TypeScript, pnpm workspace, exact pins, Biome, Vitest, GitHub Actions CI (`check`).
- Packages: `packages/formats` (Zod schemas + types), `packages/cli`, `packages/player` (React component). Every `package.json` sets `"license": "MIT"`.
- External tools: Python `faster-whisper`; binaries `rhubarb` and `ffmpeg`; Playwright for `--mp4`. The CLI checks for them at start and prints install hints.
- **CI mocks them:** TTS providers, Rhubarb and whisper sit behind adapter interfaces; unit tests use fakes returning fixture audio/cues/timings. CI never calls paid APIs or needs the binaries. An optional, manually triggered integration job may run the real tools.

## Steps

### G0: Maintainer approves this plan
- Depends on: none
- Touches: plans/P1-plan.md
- Acceptance: approval recorded here. Open questions are settled (see *Settled decisions*): MIT license, npm distribution, captions only on TTS failure.

### S1: Repo scaffold + CI + tests
- Depends on: G0
- Touches: package.json, pnpm-workspace.yaml, pnpm-lock.yaml, biome.json, tsconfig*.json, packages/*/package.json, .github/workflows/**
- Acceptance: `pnpm check` runs lint, typecheck and a sample Vitest test in every package; CI `check` workflow green on PR; branch protection requires `check`; all deps exact-pinned; every `package.json` has `"license": "MIT"`.

### S2: Formats, Zod schemas + validation CLI
- Depends on: S1
- Touches: packages/formats/**, packages/cli/src/validate/**
- Acceptance: schemas for cast (per-speaker `voice.provider` + `voice.voiceId`, 8 required mouth shapes plus optional `L`/`TH`, one anchor), script, overrides (`[{time, shape}]`) and line.json (`cues: [{time, shape}]`, `words`); shape names are a shared enum; `pnpm talk validate` reports each pre-flight error (missing mouth, unknown/untagged speaker, unknown provider or missing voice ID, > 20 s estimate, mismatched mouth sizes, no transparency, not registered to the shared anchor) with file and line id; tests use generated placeholder images.

### S3: TTS providers + cache
- Depends on: S2
- Touches: packages/cli/src/tts/**, packages/cli/src/cache/**
- Acceptance: `TtsProvider` plugin interface with a provider registry; Gemini provider sends style as a separate field (test proves spoken text has no instruction); switching a speaker’s provider is config-only (test with two fake providers); no failover: a failing provider marks the line as failed with no retry on another provider; `[pause N]` produces silence; cache keyed by `line_id` — hit skips the API call, changing text, provider, voice ID, style or art invalidates; tests use fake providers.

### S4: Rhubarb + whisper timing → line.json
- Depends on: S3
- Touches: packages/cli/src/align/**, packages/cli/src/build/**
- Acceptance: Rhubarb run on the audio with the script text as `--dialogFile` and JSON export; shapes mapped A→`MBP`, B→`CONS/EE`, C→`EH/AE`, D→`AH`, E→`OH/ER`, F→`OO/W`, G→`FV`, H→`L` (or `EH/AE` without `L`), X→`REST`; per-line overrides merged on top (replace, insert, remove, re-sort; tested); anticipation lead applied to `MBP` and `OO/W`; timing cached by `line_id`; word timings from faster-whisper; `pnpm talk build` writes valid `line.json` per line; adapters mocked in CI with fixtures.

### S5: `<SpeakingAvatar>` React component
- Depends on: S2
- Touches: packages/player/**
- Acceptance: uses the audio element’s `currentTime` as master clock and binary-searches the latest cue at or before it (unit-tested, including seek, pause and playback-rate changes); no free-running animation timer; all mouth images share the anchor (no layout shift on swap); captions follow the same clock; missing/failed audio shows caption only; reduced-motion disables mouth animation; no network calls during playback; example page with placeholder art for `narrator` and `guide`.

### S6: `--mp4` render
- Depends on: S4, S5
- Touches: packages/cli/src/render/**
- Acceptance: produces an MP4 whose duration matches the audio; skipped in CI when ffmpeg/Playwright browsers are absent, covered by unit tests of the command builder.

### S7: Release v0.1.0 to npm + usage docs
- Depends on: S6
- Touches: README.md, docs/**, CHANGELOG.md, .github/workflows/release.yml, packages/*/package.json
- Acceptance: npm package name chosen and confirmed available on npm; release workflow publishes on a `v*` tag with `--provenance` using the `NPM_TOKEN` secret; `v0.1.0` tag published to npm with provenance; README covers install from npm, file formats, the art-kit spec, CLI, component usage and external tool setup; a fresh example project installed from npm builds using only the docs.
