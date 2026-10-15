# P1 plan: talking-avatar v0.1.0

Status: **draft — awaiting Bob’s approval (G0)**

## Goal

A story-neutral tool that turns a script of lines into speaking-character assets: voiced audio, mouth-shape timings and word timings per line, plus a React component that plays them and an optional MP4 render.

Scripts, art and voices always live in the **consuming project**, never in this repo. This repo ships only tiny generic example assets (or generated placeholders) for tests and docs, using neutral example characters such as `narrator` and `guide`. Nothing is copied from any earlier demo.

## CLI

```sh
pnpm talk build <script.yaml> --cast <cast.yaml> [--mp4]
```

Per line:

1. **TTS** (Gemini TTS) with the speaker’s voice. The style/delivery instruction is passed as its **own field** to the provider, never concatenated into the spoken text (a previous bug read the instruction aloud). A test asserts the request text equals the line text.
2. **Rhubarb Lip Sync** on the audio, mapped to 5 mouth shapes: `rest`, `slight`, `open`, `wide`, `oo`.
3. **faster-whisper** word timings.
4. Writes one `line.json`: audio file path, mouth cues `[{t, mouth}]`, word timings `[{word, start, end}]`.

**Cache:** keyed by a hash of text + voice config + art; unchanged lines are not re-synthesised. **Line ids are stable** and never change or get reused.

**Pre-flight checks (before any paid API call):**

- missing mouth image for a speaker;
- untagged or unknown speaker;
- line estimated longer than 20 s;
- invalid mouth kit: all mouth images must be the same size, have transparency, and be drawn to the cast anchor.

## Formats

`cast.yaml` (per character):

```yaml
narrator:
  voice: { provider: gemini, name: <voice-name>, style: "calm, warm" }
  portrait: art/narrator.png
  mouths: { rest: m/rest.png, slight: m/slight.png, open: m/open.png, wide: m/wide.png, oo: m/oo.png }
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

`[pause N]` inserts N seconds of silence. All formats are validated with Zod schemas.

## Player

`<SpeakingAvatar line={lineJson} cast={...} />` plays a `line.json`: swaps mouth images on cue, shows word-by-word captions, and respects `prefers-reduced-motion` (no mouth animation; captions still shown).

## `--mp4`

Renders the component via Playwright and muxes with FFmpeg, for sharing and trailers.

## Distribution

Consumers depend on this repo at a **pinned version tag** via pnpm (git dependency or npm, see open questions).

## Stack

- TypeScript, pnpm workspace, exact pins, Biome, Vitest, GitHub Actions CI (`check`).
- Packages: `packages/formats` (Zod schemas + types), `packages/cli`, `packages/player` (React component).
- External tools: Python `faster-whisper`; binaries `rhubarb` and `ffmpeg`; Playwright for `--mp4`. The CLI checks for them at start and prints install hints.
- **CI mocks them:** TTS, Rhubarb and whisper sit behind adapter interfaces; unit tests use fakes returning fixture audio/cues/timings. CI never calls paid APIs or needs the binaries. An optional, manually triggered integration job may run the real tools.

## Steps

### G0: Bob approves this plan
- Depends on: none
- Touches: plans/P1-plan.md
- Acceptance: Bob’s approval recorded here; open questions answered.

### S1: Repo scaffold + CI + tests
- Depends on: G0
- Touches: package.json, pnpm-workspace.yaml, pnpm-lock.yaml, biome.json, tsconfig*.json, packages/*/package.json, .github/workflows/**
- Acceptance: `pnpm check` runs lint, typecheck and a sample Vitest test in every package; CI `check` workflow green on PR; branch protection requires `check`; all deps exact-pinned.

### S2: Formats, Zod schemas + validation CLI
- Depends on: S1
- Touches: packages/formats/**, packages/cli/src/validate/**
- Acceptance: schemas for cast, script and line.json; `pnpm talk validate` reports each pre-flight error (missing mouth, unknown/untagged speaker, > 20 s estimate, mismatched mouth sizes, no transparency, anchor mismatch) with file and line id; tests use generated placeholder images.

### S3: TTS + cache
- Depends on: S2
- Touches: packages/cli/src/tts/**, packages/cli/src/cache/**
- Acceptance: Gemini adapter sends style as a separate field (test proves spoken text has no instruction); `[pause N]` produces silence; cache hit skips the API call; changing text, voice or art invalidates; tests use a fake provider.

### S4: Rhubarb + whisper alignment → line.json
- Depends on: S3
- Touches: packages/cli/src/align/**, packages/cli/src/build/**
- Acceptance: Rhubarb shapes mapped to the 5 mouths; word timings from faster-whisper; `pnpm talk build` writes valid `line.json` per line; adapters mocked in CI with fixtures.

### S5: SpeakingAvatar component
- Depends on: S2
- Touches: packages/player/**
- Acceptance: plays a fixture line.json with correct mouth swaps and captions (Vitest + DOM tests); reduced-motion disables mouth animation; example page with placeholder art.

### S6: `--mp4` render
- Depends on: S4, S5
- Touches: packages/cli/src/render/**
- Acceptance: produces an MP4 whose duration matches the audio; skipped in CI when ffmpeg/Playwright browsers are absent, covered by unit tests of the command builder.

### S7: Release v0.1.0 + usage docs
- Depends on: S6
- Touches: README.md, docs/**, CHANGELOG.md
- Acceptance: `v0.1.0` tag; README covers install at a pinned tag, file formats, CLI, component usage and external tool setup; a fresh example project builds using only the docs.

## Open questions for Bob

1. License: MIT?
2. Distribution: publish to npm, or git tag only?
3. TTS fallback if Gemini TTS is unavailable: which provider (or none for v0.1.0)?
