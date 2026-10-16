# talking-avatar asset contract v1

Status: **locked (v1)**. Changes need a new version of this document.

This is the file contract between the artist (Illusionist) and the code: `@talking-avatar/formats` validates it, `@talking-avatar/player` plays it, and consumers such as Bloodtower serve it as static files. It covers the first slice (S2 + thin S5). The fuller `cast.yaml` / `script.yaml` / `line.json` pipeline in [plans/P1-plan.md](../plans/P1-plan.md) still applies to the CLI.

## Layout

One folder per character:

```text
avatars/<id>/
  manifest.json
  portrait.png
  anchor.json
  mouths/
    REST.png
    MBP.png
    CONS-EE.png
    EH-AE.png
    AH.png
    OH-ER.png
    OO-W.png
    FV.png
  lines/
    <line_id>.m4a
    <line_id>.json      # Rhubarb JSON
  masters/              # artist only, NOT shipped
    <line_id>.wav
```

- **Mouth file names.** The shape ids `CONS/EE`, `EH/AE`, `OH/ER`, `OO/W` contain `/`, which is not filesystem-safe. File names replace `/` with `-`: `CONS-EE.png`, `EH-AE.png`, `OH-ER.png`, `OO-W.png`. This matches the names Illusionist already uses. Shape ids inside JSON keep the `/` form.
- **WAV masters** are kept by the artist. They may live in `masters/`, which is excluded from packaging and from the consumer's static build. Only `.m4a` ships. TTS segment files and other working files also stay out of the shipped folder.
- All paths inside `manifest.json` are **relative to `avatars/<id>/`**. No absolute paths.

## manifest.json

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | equals the folder name |
| `name` | string | display name |
| `portrait` | string | path to the portrait PNG |
| `anchor` | string | path to `anchor.json` |
| `mouths` | object | all 9 Rhubarb letters `X A B C D E F G H` → mouth file path |
| `mouthMode` | `"frame"` \| `"overlay"`, optional | default `"frame"`; see *Mouth mode* |
| `captionTheme` | string, optional | non-empty if present |
| `lines` | array | `{ line_id, audio, timing, text }` |

Letter map (fixed for v1):

| Letter | Shape | File |
| --- | --- | --- |
| X | `REST` | `mouths/REST.png` |
| A | `MBP` | `mouths/MBP.png` |
| B | `CONS/EE` | `mouths/CONS-EE.png` |
| C | `EH/AE` | `mouths/EH-AE.png` |
| D | `AH` | `mouths/AH.png` |
| E | `OH/ER` | `mouths/OH-ER.png` |
| F | `OO/W` | `mouths/OO-W.png` |
| G | `FV` | `mouths/FV.png` |
| H | `CONS/EE` | `mouths/CONS-EE.png` |

Note: H → `CONS/EE` replaces the earlier P1 rule (H → `EH/AE` when the kit has no `L`). P1 is aligned to this contract.

Each `lines[]` entry:

- `line_id`: exactly the script's `line_id` (case and punctuation included). Unique in the manifest.
- `audio`: path to `lines/<line_id>.m4a`.
- `timing`: path to `lines/<line_id>.json`.
- `text`: the script line, `[pause N]` markup included. The player strips markup for captions.

## Mouth mode

`manifest.json` has an optional `mouthMode`: `"frame"` (default) or `"overlay"`.

- `frame`: every mouth file is the full portrait at the portrait's exact pixel size. The player swaps the whole image. The slice (the Keeper) uses this.
- `overlay` (later): every mouth file is a transparent PNG cropped to the anchor box. The player draws it over the portrait in the anchor box.

The validator checks mouth image sizes for the chosen mode. `anchor.json` is required in both modes.

## anchor.json

```json
{ "x": 0.508, "y": 0.649, "w": 0.26, "h": 0.29 }
```

All four values are fractions `0..1` of the portrait's width (`x`, `w`) and height (`y`, `h`). `x`, `y` is the **mouth center**; `w`, `h` is the mouth box size. In `overlay` mode every mouth image is drawn into this same box, so swaps do not jitter. In `frame` mode the mouth files are full portraits and the box only records where the mouth is.

The anchor is in fractions, not pixels, so the portrait can scale. P1's `cast.yaml` uses the same fractions.

## Timing

`lines/<line_id>.json` is Rhubarb's `--exportFormat json` output, unchanged:

```json
{
  "metadata": { "soundFile": "ts-keeper-001.wav", "duration": 7.4 },
  "mouthCues": [
    { "start": 0.0, "end": 0.03, "value": "X" },
    { "start": 0.03, "end": 0.14, "value": "H" }
  ]
}
```

Times are seconds. `metadata.soundFile` is informational; use a relative name, not an absolute path. Word timing is optional for the slice; captions show the whole line.

## Validation rules (S2 validator)

`@talking-avatar/formats` rejects a character folder unless:

1. All 9 letters `X A B C D E F G H` are mapped in `mouths`.
2. Every referenced file exists: portrait, anchor, each mouth, each line's audio and timing.
3. Each `line_id` is unique and has both `audio` and `timing`.
4. `anchor.x`, `y`, `w`, `h` are numbers in `0..1`.
5. Every cue `value` is one of `A B C D E F G H X`.
6. Cues are in order with no overlap: each cue has `start <= end`, and each cue's `start >=` the previous cue's `end`.
7. `captionTheme`, if present, is a non-empty string.
8. `mouthMode`, if present, is `"frame"` or `"overlay"`, and every mouth image has the size that mode requires (see *Mouth mode*).

Errors name the file and `line_id`.

## Example: the Keeper

`avatars/keeper/manifest.json`:

```json
{
  "id": "keeper",
  "name": "The Keeper",
  "portrait": "portrait.png",
  "anchor": "anchor.json",
  "mouthMode": "frame",
  "mouths": {
    "X": "mouths/REST.png",
    "A": "mouths/MBP.png",
    "B": "mouths/CONS-EE.png",
    "C": "mouths/EH-AE.png",
    "D": "mouths/AH.png",
    "E": "mouths/OH-ER.png",
    "F": "mouths/OO-W.png",
    "G": "mouths/FV.png",
    "H": "mouths/CONS-EE.png"
  },
  "lines": [
    {
      "line_id": "ts-keeper-001",
      "audio": "lines/ts-keeper-001.m4a",
      "timing": "lines/ts-keeper-001.json",
      "text": "Light them if you can. [pause 0.5] The key is at the bottom. It always is."
    },
    {
      "line_id": "ts-keeper-002",
      "audio": "lines/ts-keeper-002.m4a",
      "timing": "lines/ts-keeper-002.json",
      "text": "Mind the third step. It remembers everyone who ever fell on it."
    },
    {
      "line_id": "ts-keeper-003",
      "audio": "lines/ts-keeper-003.m4a",
      "timing": "lines/ts-keeper-003.json",
      "text": "Go on, then. I'll keep the lamp lit until you're back. I always do."
    }
  ]
}
```

`avatars/keeper/anchor.json` (measured by Illusionist on the approved portrait):

```json
{ "x": 0.508, "y": 0.649, "w": 0.263671875, "h": 0.29296875 }
```

## Delivery

Illusionist produces, per character: `portrait.png`, the 8 mouth PNGs (sized for the `mouthMode`), `anchor.json`, Rhubarb timing JSON per line, WAV masters (kept in `masters/`), and `.m4a` per line.

Before merge, assets pass the gate:

- **Illusionist**: art and audio final, folder matches this contract.
- **Loremaster**: line text and `line_id`s match the script.
- **Gamewright**: lines fit the scene and play in the consumer.
- **Bob**: spot-check on the target device.

The S2 validator must pass first.
