# P1 plan: talking-avatar v0.1.0

Status: **draft — awaiting maintainer approval (G0)**

## Goal

A story-neutral tool that turns a script of lines into speaking-character assets: voiced audio, mouth-shape cue tracks and word timings per line, plus a React component that plays them and an optional MP4 render.

Scripts, art and voices always live in the **consuming project**, never in this repo. This repo ships only tiny generic example assets (or generated placeholders) for tests and docs, using neutral example characters such as `narrator` and `guide`. Nothing is copied from any earlier demo.

Background and rationale for the mouth set, timing and playback rules: [docs/lip-sync-best-practices.md](../docs/lip-sync-best-practices.md).

## Settled decisions (G0 answers)

- **License:** MIT. The repo has a `LICENSE` file (copyright `talking-avatar contributors`, 2026) and every `package.json` sets `"license": "MIT"`.
- **Distribution:** releases are published to **npm**; consumers install from npm at an exact version.
- **TTS failure:** no fallback provider and no backup voice. Synthesis failure or missing audio still writes a `line.json` whose `text` is the script line. The player shows that caption only, and the mouth stays `REST`.
- **TTS is per speaker.** `voice.provider` and `voice.voiceId` live on the cast entry. There is no second voice.
- **Mouth kit:** eight required shapes — `REST`, `MBP`, `CONS/EE`, `EH/AE`, `AH`, `OH/ER`, `OO/W`, `FV`. `L` and `TH` are optional.
- **Timing:** Rhubarb times the audio. A per-line hand-correction file overrides that track.
- **Playback:** while audio is playing, a per-frame callback samples `audio.currentTime`. That sample is the only clock for mouths and captions.

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

1. **Generate (TTS)** with the speaker’s configured provider and voice ID (see *TTS providers*). The style/delivery instruction is passed as its **own field**, never concatenated into the spoken text. `[pause N]` is not spoken: the provider is called once per spoken segment, and the request `text` is that segment only (see *Pauses*).
2. **Time (Rhubarb Lip Sync)** on the generated WAV, with `--dialogFile` set to the spoken words (pause markup stripped) and `--exportFormat json`. The **audio is the timing authority**. Cue times come from Rhubarb’s `mouthCues[].start`, never from text length estimates. Letters are mapped onto the 8-shape kit (see *Rhubarb JSON*).
3. **Overrides:** if `<line_id>.overrides.json` exists, it is merged onto the mapped track, then the anticipation lead is applied (see *Timing*).
4. **faster-whisper** word timings for captions when audio exists. The script `text` is stored either way.
5. **Write `line.json`** (see *Formats*). A failed line still gets a file: caption text, fallback word timings, `audio: null`, `cues: []`.

**Cache:** keyed by `line_id`. The TTS cache material is `text`, `provider`, `voiceId`, and `style`. The timing cache material is the stripped dialog text, a hash of the WAV bytes, a hash of the art bytes, `anticipationFrames`, `frameRate`, the `rhubarb --version` string, and the extended-shapes flag (`GX` or `GHX`). Each cache key is SHA-256 of that JSON object with those fields in that order. Changing the anticipation lead or the Rhubarb version misses the timing cache. Changing only the overrides file re-runs the merge and the lead; it does not re-synthesize or re-run Rhubarb. **Line ids are stable** and never change or get reused.

**Pre-flight checks (before any paid API call):**

- missing mouth image for a speaker (any of the 8 required shapes);
- untagged or unknown speaker;
- unknown voice provider, or a speaker with no voice ID;
- invalid `[pause N]` markup;
- estimated duration **greater than 20 s**. The estimate is `sum of pause seconds + (spoken non-whitespace Unicode code points / 12.5)`. 12.5 characters per second is about 150 words per minute at 5 characters per word. A line of exactly 20 s passes; 20.01 s fails. This estimate is only a guard. It is not the timing authority;
- invalid mouth kit: every mouth image is a PNG of the same pixel width and height with an alpha channel, and `anchor` is present and inside the image (`0 <= x < width`, `0 <= y < height`).

Registration to the anchor is a **draw-time** offset: the player draws each mouth so that anchor pixel sits on the same portrait point. Pre-flight does not infer registration from pixel bytes.

## TTS providers

TTS is a **parameter**, not a hard-wired service. Each speaker in `cast.yaml` names its `provider` and `voiceId`. Providers sit behind a small plugin interface:

```ts
interface TtsProvider {
  id: string; // e.g. "gemini"
  synthesize(req: {
    text: string;
    voiceId: string;
    style?: string;
  }): Promise<{
    audio: Uint8Array;
    format: "wav" | "ogg"; // WAV PCM, or Ogg Vorbis. Not Opus, not MP3.
    sampleRate: number;
    channels: number;
  }>;
}
```

`wav` means a WAV container of PCM. `ogg` means Ogg Vorbis. Rhubarb reads those two and nothing else in this project. Switching a speaker to another provider is a **config change** only. v0.1.0 ships one real provider (Gemini TTS) plus a fake for tests. There is **no automatic failover** and no backup voice.

If any segment fails, the segments disagree on sample rate, channel count, or format, or the audio cannot be decoded, the line is **caption-only**: no partial audio is kept, no other provider is tried, and `captionOnlyLine` is written.

## Pauses

`[pause N]` is silence, not words. `N` is a non-negative decimal number of seconds (`0`, `0.5`, `1.25`). The marker is lowercase `pause` with a closing bracket. Anything else that starts with `[pause` (missing number, negative number, different case, unclosed bracket) is a validation error.

`Welcome. [pause 0.5] Follow me.` splits into:

1. speech `Welcome.`
2. silence `0.5` seconds
3. speech `Follow me.`

**TTS requests.** One `synthesize` call per non-empty spoken segment, in order. For the sample line the requests are exactly `{ text: "Welcome.", ... }` and `{ text: "Follow me.", ... }`. The raw line, including `[pause 0.5]`, is never sent. Style stays a separate field. A test asserts those two texts and asserts that no request text contains `[pause`.

**Silence.** The CLI decodes each segment to 16-bit PCM, inserts `round(N * sampleRate)` frames of zeros per channel, and writes the line audio as **WAV PCM** for Rhubarb. A pause-only line (no spoken segments) uses 22050 Hz mono. `N = 0` inserts no frames and still strips the marker.

**Rhubarb dialog file.** The file is the spoken segments joined by a single space, markers removed. The sample line’s dialog file is `Welcome. Follow me.` Pause markup is not written into it. Rhubarb times the concatenated WAV, whose silence is already in the audio.

## Mouth set

An **8-shape required set**, mapped from Rhubarb Lip Sync’s letters (A–H plus X, per the [Rhubarb README](https://github.com/DanielSWolf/rhubarb-lip-sync#mouth-shapes)):

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

Every speaker’s kit provides these images, all the same pixel size, PNG with an alpha channel, positioned on the shared anchor at draw time:

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

## Rhubarb JSON

`rhubarb --exportFormat json` writes this shape, and CI fixtures use this shape (not a pre-mapped cue array):

```json
{
  "metadata": {
    "soundFile": "audio/intro-001.wav",
    "duration": 1.86
  },
  "mouthCues": [
    { "start": 0.00, "end": 0.05, "value": "X" },
    { "start": 0.05, "end": 0.42, "value": "C" }
  ]
}
```

`metadata.soundFile` is a string, `metadata.duration` is a number in seconds, and each mouth cue has numeric `start` and `end` plus a letter `value` (`A`–`H` or `X`). TSV is `start<tab>letter` per row. This project does not parse TSV.

The adapter converts each mouth cue to the internal cue track:

- `time` = `start`
- `shape` = the kit id in the *Mouth set* table
- drop `end` (the next cue’s `start` is the boundary; the player holds the latest cue through the audio)
- do not store `metadata` on the cue

`packages/formats/fixtures/rhubarb-intro-001.json` is a real Rhubarb document. The formats tests map it.

## Timing

- The **recorded or generated audio is the timing authority**.
- Rhubarb produces the JSON document above. The mapped track is `[{time, shape}]` with kit ids.
- **Overrides** are one object, not an array. `<line_id>.overrides.json`:

```json
{
  "cues": [
    { "time": 0.42, "shape": "MBP" },
    { "time": 1.1, "shape": "FV" }
  ],
  "remove": [0.18]
}
```

`cues` and `remove` may be omitted; they default to empty. Times match the mapped Rhubarb `start` values with exact numeric equality (artists copy `start`, they do not recompute it). Merge order:

1. Map Rhubarb letters to kit ids.
2. Upsert `cues`: the same `time` replaces the shape; a new `time` is inserted.
3. Delete every cue whose `time` is listed in `remove`. A time that appears in both lists is removed.
4. Apply anticipation (below) to `MBP` and `OO/W` cues that were **not** written by a surviving override. Override times stay exactly as authored.
5. Sort by `time` ascending.

- **Anticipation.** `MBP` and `OO/W` need to be on the mouth slightly before the sound. The lead is `anticipationFrames / frameRate` seconds. Defaults: `frameRate = 24`, `anticipationFrames = 2`, so the lead is `2/24` s. Both values are positive configuration (`anticipationFrames` may be `0` to disable the lead). For each eligible cue at time `t`, in increasing time order, the candidate is `max(0, t - lead)`. If there is no previous cue, or the previous cue’s time is **strictly less** than the candidate, the cue moves to the candidate. Otherwise the cue stays where Rhubarb put it (the lead window is already occupied — there is no room to show an earlier shape, which is the “Rhubarb has not already anticipated this” check). A cue at time `0` stays at `0`. The shift never moves a cue earlier than or onto the previous cue, so a cue at `0` cannot become negative.

## Formats

`cast.yaml` (per character). The sample script below uses `narrator`. `guide` is the second example character and uses this same shape of entry; the S5 example page includes both.

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
    speaker: narrator
    note: "optional direction for humans"
    text: "Welcome. [pause 0.5] Follow me."
```

`line.json` always carries the script text. `text` is the raw line, pause markup included. The player displays it with markers stripped (`Welcome. Follow me.`).

Successful line (`captionTiming: "whisper"`, words from faster-whisper):

```json
{
  "lineId": "intro-001",
  "text": "Welcome. [pause 0.5] Follow me.",
  "audio": "audio/intro-001.wav",
  "cues": [
    { "time": 0.0, "shape": "REST" },
    { "time": 0.05, "shape": "EH/AE" }
  ],
  "words": [{ "word": "Welcome.", "start": 0.05, "end": 0.6 }],
  "captionTiming": "whisper"
}
```

Caption-only line, written when synthesis fails or the audio is missing. The mouth has no cues, so the player holds `REST`. Word timings use the same 12.5 characters/second estimate as the 20 s guard, and pauses insert gaps. `Welcome.` is 8 characters (0.64 s), then 0.5 s of pause, then `Follow` (0.48 s) and `me.` (0.24 s):

```json
{
  "lineId": "intro-001",
  "text": "Welcome. [pause 0.5] Follow me.",
  "audio": null,
  "cues": [],
  "words": [
    { "word": "Welcome.", "start": 0.0, "end": 0.64 },
    { "word": "Follow", "start": 1.14, "end": 1.62 },
    { "word": "me.", "start": 1.62, "end": 1.86 }
  ],
  "captionTiming": "fallback"
}
```

If whisper fails but audio exists, `text` and `audio` stay, `captionTiming` is `"fallback"`, and `words` use this same estimate (not stretched to the audio duration). Captions never depend on whisper having run.

All formats (cast, script, overrides, line.json, Rhubarb JSON) are validated with Zod schemas in `@talking-avatar/formats`.

## Player

`<SpeakingAvatar line={lineJson} cast={...} />` plays a `line.json`:

- **Master clock while audio exists:** a per-frame callback (requestAnimationFrame or the host equivalent) **samples `audio.currentTime`**. It binary-searches the cue track for the latest cue at or before that sample. It does **not** use the `timeupdate` event as the driver (`timeupdate` is too coarse). It does **not** advance a separate elapsed-time clock while an audio element is playing. Pause, seek, buffering, and playback-rate changes stay in sync because they all move `currentTime`.
- **Before the first cue** the mouth is `REST`.
- Captions follow the same audio clock. The visible caption string is `text` with `[pause N]` removed. Word highlighting uses `words`.
- If `audio` is null or the element fails to load: show the caption only, leave the mouth on `REST`, and do not load another voice. Word highlighting then uses a caption clock: seconds since this caption-only line started, sampled once per frame, binary-searched against `words`. That clock never selects a mouth shape. If `words` is empty, show the stripped `text` as a static caption.
- `prefers-reduced-motion`: the mouth stays `REST` for the whole line. Captions still advance on the audio clock, or on the caption clock when there is no audio.

## `--mp4`

Renders the component via Playwright and muxes with FFmpeg, for sharing and trailers.

## Distribution

Published to **npm** from this pnpm workspace. Consumers install an exact version.

| Package | Name | Published |
| --- | --- | --- |
| repo root | `talking-avatar` | no — `"private": true` |
| `packages/formats` | `@talking-avatar/formats` | yes |
| `packages/cli` | `@talking-avatar/cli` | yes |
| `packages/player` | `@talking-avatar/player` | yes |

S7 confirms these names are free on npm before the first publish. Working versions in the scaffold are `0.0.0`.

Every publishable `package.json` has:

- `"license": "MIT"`
- `"type": "module"`
- `exports` and `types` pointing at `dist` for consumers (`publishConfig.exports` / `publishConfig.types` drop the workspace-only `development` condition, which points at `src`)
- `files`: `dist` and `LICENSE` (a byte-for-byte copy of the repo root `LICENSE`, so the tarball contains the copyright notice)
- `publishConfig.access`: `"public"` (the names are scoped)
- exact dependency versions (`workspace:*` only for workspace links; no `^` or `~`)

Root `package.json` sets `"private": true`, `"packageManager": "pnpm@10.33.4"`, and `"license": "MIT"`. `pnpm check` is lint + typecheck + test. `pnpm-lock.yaml` is committed.

Release workflow (`.github/workflows/release.yml`):

- Trigger: tags matching `v[0-9]*` (so `voice` and `vlatest` do not run). A bash step then requires `^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$` and exits non-zero otherwise. `v0.1.0` and `v1.2.3-beta.1` publish; `v1`, `v1.2`, and `version-1` do not.
- `pnpm/action-setup@v4` with `version: 10.33.4`, the same pin as `packageManager`. Node 22. `pnpm install --frozen-lockfile`, then `pnpm check`, then `pnpm -r run build`.
- Publish only the workspace packages, not the private root:

```sh
pnpm -r --filter "./packages/*" publish --provenance --access public --no-git-checks
```

- Each publishable package’s `version` must equal the tag with the leading `v` removed. `NPM_TOKEN` is the npm token. `id-token: write` is the provenance permission.
- CI `check` (`.github/workflows/check.yml`) runs the same pnpm pin and `pnpm check` on pull requests and on pushes to `main`.

## Stack

- TypeScript, pnpm workspace, exact pins, Biome, Vitest, GitHub Actions CI (`check`).
- Packages: `packages/formats` (Zod schemas, pause/caption/Rhubarb/override/anticipation/playback helpers), `packages/cli`, `packages/player` (React component). Every `package.json` sets `"license": "MIT"`.
- External tools: Python `faster-whisper`; binaries `rhubarb` and `ffmpeg`; Playwright for `--mp4`. The CLI checks for them at start and prints install hints.
- **CI mocks them:** TTS providers, Rhubarb and whisper sit behind adapter interfaces; unit tests use fakes and the Rhubarb JSON fixture. CI never calls paid APIs or needs the binaries. An optional, manually triggered integration job may run the real tools.
- The pure helpers and the workspace scaffold are already in the repo so `pnpm check` and the release workflow are real. Later steps wire them into the CLI and the React component. They use these schemas; they do not invent a second one.

## Steps

### G0: Maintainer approves this plan
- Depends on: none
- Touches: plans/P1-plan.md
- Acceptance: approval recorded here. Open questions are settled (see *Settled decisions*): MIT license, npm distribution, captions only on TTS failure.

### S1: Repo scaffold + CI + tests
- Depends on: G0
- Touches: package.json, pnpm-workspace.yaml, pnpm-lock.yaml, biome.json, tsconfig*.json, packages/*/package.json, .github/workflows/**
- Acceptance: `pnpm check` runs lint, typecheck, and Vitest (a test in every package plus the packaging test). CI `check` is green on the PR. Branch protection on `main` requires the `check` status. Dependencies are exact-pinned. Root `package.json` is `"private": true` and sets `packageManager` to the pnpm version pinned in both workflows. Every publishable package has `license`, `exports`, `types`, `files` (including `LICENSE`), and `publishConfig.access: "public"`. `pnpm -r --filter "./packages/*" publish` is the only publish command. The `check` workflow and the pinned release workflow exist. The scaffold may land in the plan PR so those workflows are not dangling.

### S2: Formats, Zod schemas + validation CLI
- Depends on: S1
- Touches: packages/formats/**, packages/cli/src/validate/**
- Acceptance: cast, script, overrides, line.json, and Rhubarb JSON match the *Formats* and *Rhubarb JSON* sections. Overrides are the object `{ cues, remove }`, not an array. `line.json.text` is required and `audio` is `string | null`. Shape names are the shared enum (8 required, `L` and `TH` optional). `pnpm talk validate` reports each pre-flight error with file and line id: missing mouth, unknown or untagged speaker, unknown provider or missing voice ID, invalid pause markup, estimate `> 20` using the 12.5 characters/second formula, mismatched PNG sizes, PNG without an alpha channel, anchor missing or outside the image. It does not claim to see anchor registration from pixels. Tests use generated placeholder images.

### S3: TTS providers + cache
- Depends on: S2
- Touches: packages/cli/src/tts/**, packages/cli/src/cache/**
- Acceptance: `TtsProvider` registry. Gemini sends `style` as its own field (the test’s spoken text has no instruction and no `[pause` marker). For `Welcome. [pause 0.5] Follow me.` the provider is called twice, with `text` exactly `Welcome.` and `Follow me.`. Silence is PCM zeros spliced between those segments and the line is saved as WAV. Switching provider is config-only (two fakes). No failover: one failed segment writes caption-only `line.json` (`text` kept, `audio: null`, `cues: []`, `captionTiming: "fallback"`, fallback `words`) and does not call another provider. TTS cache key changes when text, provider, voice ID, or style changes, and a hit skips the API call. Tests use fake providers.

### S4: Rhubarb + whisper timing → line.json
- Depends on: S3
- Touches: packages/cli/src/align/**, packages/cli/src/build/**
- Acceptance: Rhubarb runs on the WAV with `--dialogFile` equal to the stripped spoken text (`Welcome. Follow me.` for the sample) and `--exportFormat json`. Fixtures are Rhubarb documents `{ metadata, mouthCues: [{ start, end, value }] }` with letter values. Mapping is A `MBP`, B `CONS/EE`, C `EH/AE`, D `AH`, E `OH/ER`, F `OO/W`, G `FV`, H `L` or `EH/AE` when the kit has no `L`, X `REST`; `end` is dropped. Overrides use the object schema: replace, insert, remove (remove wins when a time is in both), then re-sort. Anticipation then applies the `2/24` s default lead to non-override `MBP` and `OO/W`, clamped at 0, and leaves a cue unshifted when the previous cue already occupies the lead window. Timing cache material includes `anticipationFrames`, `frameRate`, and the Rhubarb version. Word timings come from faster-whisper when audio exists; whisper failure still fills fallback `words` and keeps `text`. `pnpm talk build` writes a valid `line.json` per line. Adapters are mocked in CI.

### S5: `<SpeakingAvatar>` React component
- Depends on: S2
- Touches: packages/player/**
- Acceptance: a per-frame callback samples `audio.currentTime` and binary-searches the latest cue at or before it (unit-tested, including seek, pause, and playback-rate changes). `timeupdate` is not the driver. No separate elapsed clock while audio plays. Before the first cue the mouth is `REST`. All mouth images share the anchor at draw time (no layout shift on swap). Captions use `line.text` with pause markup stripped and follow the same audio clock. `audio: null` or a failed audio element shows that caption only, holds `REST`, and highlights words from the fallback timings on the caption clock. `prefers-reduced-motion` holds `REST` and still shows captions. No network calls during playback. Example page with placeholder art for `narrator` and `guide`.

### S6: `--mp4` render
- Depends on: S4, S5
- Touches: packages/cli/src/render/**
- Acceptance: produces an MP4 whose duration matches the audio; skipped in CI when ffmpeg/Playwright browsers are absent, covered by unit tests of the command builder.

### S7: Release v0.1.0 to npm + usage docs
- Depends on: S6
- Touches: README.md, docs/**, CHANGELOG.md, .github/workflows/release.yml, packages/*/package.json
- Acceptance: the three scoped names are confirmed available on npm (or renamed in this step if one is taken). The release workflow publishes only `packages/*`, on a semver tag `vMAJOR.MINOR.PATCH` with optional prerelease, with `--provenance` and `NPM_TOKEN`. The tag version equals each publishable package version. `v0.1.0` is on npm with provenance, and each tarball contains the MIT `LICENSE`. README covers install from npm, file formats, the art-kit spec, CLI, component usage, and external tool setup. A fresh example project installed from npm builds using only the docs.
