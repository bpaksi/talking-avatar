// Regenerates the avatar fixtures in packages/formats/fixtures from nothing but
// code: placeholder PNGs, and (on macOS) placeholder speech from `say` encoded
// with `afconvert`. No consumer art, audio or script is used.
//
//   node packages/formats/scripts/make-fixtures.mjs               # everything (macOS)
//   node packages/formats/scripts/make-fixtures.mjs --skip-audio  # keep the Keeper's audio and timing
//
// The Keeper's timing is Rhubarb-format JSON derived from the audio's loudness,
// not Rhubarb output: good enough to see the mouth follow the voice.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");
const skipAudio = process.argv.includes("--skip-audio");

const LETTER_FILES = {
  X: "mouths/REST.png",
  A: "mouths/MBP.png",
  B: "mouths/CONS-EE.png",
  C: "mouths/EH-AE.png",
  D: "mouths/AH.png",
  E: "mouths/OH-ER.png",
  F: "mouths/OO-W.png",
  G: "mouths/FV.png",
  H: "mouths/CONS-EE.png",
};
const SHAPES = {
  REST: "mouths/REST.png",
  MBP: "mouths/MBP.png",
  "CONS/EE": "mouths/CONS-EE.png",
  "EH/AE": "mouths/EH-AE.png",
  AH: "mouths/AH.png",
  "OH/ER": "mouths/OH-ER.png",
  "OO/W": "mouths/OO-W.png",
  FV: "mouths/FV.png",
};

// ---------- PNG ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Encodes an RGBA canvas; `alpha: false` writes RGB (colour type 2). */
function encodePng(canvas, { alpha = true } = {}) {
  const channels = alpha ? 4 : 3;
  const { width, height, pixels } = canvas;
  const raw = Buffer.alloc((width * channels + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * channels + 1);
    for (let x = 0; x < width; x += 1) {
      for (let c = 0; c < channels; c += 1) {
        raw[row + 1 + x * channels + c] = pixels[(y * width + x) * 4 + c];
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function canvas(width, height, rgba = [0, 0, 0, 0]) {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) pixels.set(rgba, i * 4);
  return { width, height, pixels };
}

function setPixel(c, x, y, rgba) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  c.pixels.set(rgba, (y * c.width + x) * 4);
}

function rect(c, x, y, w, h, rgba) {
  for (let j = Math.round(y); j < Math.round(y + h); j += 1) {
    for (let i = Math.round(x); i < Math.round(x + w); i += 1) {
      setPixel(c, i, j, rgba);
    }
  }
}

function ellipse(c, cx, cy, rx, ry, rgba) {
  for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j += 1) {
    for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i += 1) {
      const dx = (i + 0.5 - cx) / rx;
      const dy = (j + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPixel(c, i, j, rgba);
    }
  }
}

// 3x5 glyphs for the shape labels.
const FONT = {
  A: "010101111101101",
  B: "110101110101110",
  C: "011100100100011",
  E: "111100110100111",
  F: "111100110100100",
  H: "101101111101101",
  M: "101111111101101",
  N: "110101101101101",
  O: "010101101101010",
  P: "110101110100100",
  R: "110101110101101",
  S: "011100010001110",
  T: "111010010010010",
  V: "101101101101010",
  W: "101101111111101",
  "/": "001001010100100",
};

function label(c, text, x, y, scale, rgba) {
  [...text].forEach((ch, index) => {
    const glyph = FONT[ch];
    if (glyph === undefined) return;
    [...glyph].forEach((bit, i) => {
      if (bit === "1") {
        rect(
          c,
          x + (index * 4 + (i % 3)) * scale,
          y + Math.floor(i / 3) * scale,
          scale,
          scale,
          rgba,
        );
      }
    });
  });
}

// ---------- the Keeper (placeholder art) ----------

const W = 256;
const H = 320;
const ANCHOR = { x: 0.5, y: 0.72, w: 0.32, h: 0.16 };
const MX = W * ANCHOR.x;
const MY = H * ANCHOR.y;

const BG = [29, 36, 51, 255];
const HOOD = [52, 45, 66, 255];
const SKIN = [201, 162, 126, 255];
const SHADE = [170, 130, 100, 255];
const DARK = [40, 22, 26, 255];
const LIP = [150, 70, 72, 255];
const TEETH = [236, 232, 220, 255];
const TONGUE = [190, 90, 95, 255];

function face() {
  const c = canvas(W, H, BG);
  ellipse(c, W / 2, H * 0.55, 112, 150, HOOD);
  ellipse(c, W / 2, H * 0.55, 80, 104, SKIN);
  for (const ex of [W / 2 - 30, W / 2 + 30]) {
    ellipse(c, ex, H * 0.47, 12, 7, TEETH);
    ellipse(c, ex, H * 0.47, 5, 6, DARK);
  }
  rect(c, W / 2 - 4, H * 0.52, 8, 26, SHADE);
  return c;
}

const MOUTHS = {
  REST: (c) => rect(c, MX - 22, MY - 2, 44, 5, LIP),
  MBP: (c) => {
    ellipse(c, MX, MY, 22, 6, LIP);
    rect(c, MX - 20, MY - 1, 40, 2, DARK);
  },
  "CONS/EE": (c) => {
    ellipse(c, MX, MY, 30, 11, LIP);
    ellipse(c, MX, MY, 26, 7, DARK);
    rect(c, MX - 22, MY - 7, 44, 5, TEETH);
    rect(c, MX - 20, MY + 3, 40, 4, TEETH);
  },
  "EH/AE": (c) => {
    ellipse(c, MX, MY, 26, 16, LIP);
    ellipse(c, MX, MY, 22, 12, DARK);
    rect(c, MX - 18, MY - 12, 36, 5, TEETH);
  },
  AH: (c) => {
    ellipse(c, MX, MY + 4, 24, 24, LIP);
    ellipse(c, MX, MY + 4, 20, 20, DARK);
    rect(c, MX - 14, MY - 16, 28, 4, TEETH);
    ellipse(c, MX, MY + 17, 12, 6, TONGUE);
  },
  "OH/ER": (c) => {
    ellipse(c, MX, MY + 2, 18, 19, LIP);
    ellipse(c, MX, MY + 2, 12, 14, DARK);
  },
  "OO/W": (c) => {
    ellipse(c, MX, MY, 12, 12, LIP);
    ellipse(c, MX, MY, 5, 6, DARK);
  },
  FV: (c) => {
    ellipse(c, MX, MY + 2, 22, 8, LIP);
    rect(c, MX - 16, MY - 5, 32, 6, TEETH);
  },
};

function keeperFrame(shape) {
  const c = face();
  MOUTHS[shape](c);
  label(c, shape, 8, 8, 3, TEETH);
  return c;
}

function keeperPortrait() {
  const c = face();
  MOUTHS.REST(c);
  return c;
}

// Placeholder lines. The ids match the contract example; the words do not.
const KEEPER_LINES = [
  {
    line_id: "ts-keeper-001",
    text: "Hello, I am a placeholder voice. [pause 0.5] Watch my mouth move.",
  },
  {
    line_id: "ts-keeper-002",
    text: "Every word you hear should open and close my lips in time.",
  },
  {
    line_id: "ts-keeper-003",
    text: "That is all for now. Tap again to hear me from the start.",
  },
];

function keeperManifest() {
  return {
    id: "keeper",
    name: "The Keeper (placeholder)",
    portrait: "portrait.png",
    anchor: "anchor.json",
    mouthMode: "frame",
    mouths: LETTER_FILES,
    lines: KEEPER_LINES.map((line) => ({
      line_id: line.line_id,
      audio: `lines/${line.line_id}.m4a`,
      timing: `lines/${line.line_id}.json`,
      text: line.text,
    })),
  };
}

// ---------- audio + timing ----------

function sayInput(text) {
  return text.replace(
    /\[pause\s+([0-9.]+)\]/g,
    (_, s) => ` [[slnc ${Math.round(Number(s) * 1000)}]] `,
  );
}

function readWavMono16(path) {
  const buf = readFileSync(path);
  let offset = 12;
  let rate = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") rate = buf.readUInt32LE(offset + 12);
    if (id === "data") {
      const samples = new Int16Array(size / 2);
      for (let i = 0; i < samples.length; i += 1) {
        samples[i] = buf.readInt16LE(offset + 8 + i * 2);
      }
      return { rate, samples };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`no data chunk in ${path}`);
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Rhubarb-format cues from loudness: silence is X, louder speech opens wider. */
function cuesFromAudio({ rate, samples }) {
  const step = Math.round(rate * 0.01);
  const rms = [];
  for (let i = 0; i + step <= samples.length; i += step) {
    let sum = 0;
    for (let j = i; j < i + step; j += 1) sum += samples[j] * samples[j];
    rms.push(Math.sqrt(sum / step));
  }
  const peak = Math.max(...rms);
  const duration = round2(samples.length / rate);
  const OPEN = ["D", "C", "E", "B", "C", "H"];
  const NARROW = ["B", "F", "A", "G", "E"];
  const cues = [];
  let frame = 0;
  let chunkIndex = 0;
  while (frame < rms.length) {
    const silent = rms[frame] < peak * 0.06;
    let end = frame + 1;
    if (silent) {
      while (end < rms.length && rms[end] < peak * 0.06) end += 1;
    } else {
      end = Math.min(frame + 9, rms.length);
      while (end > frame + 1 && rms[end - 1] < peak * 0.06) end -= 1;
    }
    const level =
      rms.slice(frame, end).reduce((a, b) => a + b, 0) / (end - frame) / peak;
    let value = "X";
    if (!silent) {
      const pick = level > 0.35 ? OPEN : NARROW;
      value = pick[chunkIndex % pick.length];
      chunkIndex += 1;
    }
    const start = round2(frame / 100);
    const previous = cues.at(-1);
    if (previous && previous.value === value) previous.end = round2(end / 100);
    else cues.push({ start, end: round2(end / 100), value });
    frame = end;
  }
  const last = cues.at(-1);
  if (last) last.end = duration;
  for (let i = 1; i < cues.length; i += 1) cues[i].start = cues[i - 1].end;
  return { duration, cues: cues.filter((cue) => cue.end > cue.start) };
}

function makeKeeperAudio(dir) {
  const work = mkdtempSync(join(tmpdir(), "keeper-audio-"));
  try {
    for (const line of KEEPER_LINES) {
      const wav = join(work, `${line.line_id}.wav`);
      execFileSync("say", [
        "-v",
        "Daniel",
        "-r",
        "165",
        "--file-format=WAVE",
        "--data-format=LEI16@22050",
        "-o",
        wav,
        sayInput(line.text),
      ]);
      execFileSync("afconvert", [
        "-f",
        "m4af",
        "-d",
        "aac",
        "-b",
        "32000",
        wav,
        join(dir, "lines", `${line.line_id}.m4a`),
      ]);
      const { duration, cues } = cuesFromAudio(readWavMono16(wav));
      writeJson(join(dir, "lines", `${line.line_id}.json`), {
        metadata: { soundFile: `${line.line_id}.wav`, duration },
        mouthCues: cues,
      });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// ---------- writing ----------

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writePng(path, c, options) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(c, options));
}

function makeKeeper() {
  const dir = join(FIXTURES, "keeper");
  const keep = join(tmpdir(), "keeper-lines-keep");
  if (skipAudio) {
    rmSync(keep, { recursive: true, force: true });
    cpSync(join(dir, "lines"), keep, { recursive: true });
  }
  rmSync(dir, { recursive: true, force: true });
  writeJson(join(dir, "manifest.json"), keeperManifest());
  writeJson(join(dir, "anchor.json"), ANCHOR);
  writePng(join(dir, "portrait.png"), keeperPortrait());
  for (const [shape, file] of Object.entries(SHAPES)) {
    writePng(join(dir, file), keeperFrame(shape));
  }
  mkdirSync(join(dir, "lines"), { recursive: true });
  if (skipAudio) {
    cpSync(keep, join(dir, "lines"), { recursive: true });
    rmSync(keep, { recursive: true, force: true });
  } else {
    makeKeeperAudio(dir);
  }
}

// ---------- minimal fixtures for the validator ----------
// Tiny frames, one line, and a stand-in .m4a: the validator checks that the
// audio exists, it never decodes it.

const MW = 32;
const MH = 40;
const MINIMAL_ANCHOR = { x: 0.5, y: 0.75, w: 0.5, h: 0.25 };
const LINE_ID = "ts-keeper-001";

function minimalManifest(mouthMode = "frame") {
  return {
    id: "keeper",
    name: "Minimal Keeper",
    portrait: "portrait.png",
    anchor: "anchor.json",
    mouthMode,
    mouths: { ...LETTER_FILES },
    lines: [
      {
        line_id: LINE_ID,
        audio: `lines/${LINE_ID}.m4a`,
        timing: `lines/${LINE_ID}.json`,
        text: "Placeholder. [pause 0.2] Line.",
      },
    ],
  };
}

function minimalTiming() {
  return {
    metadata: { soundFile: `${LINE_ID}.wav`, duration: 1 },
    mouthCues: [
      { start: 0, end: 0.2, value: "X" },
      { start: 0.2, end: 0.5, value: "D" },
      { start: 0.5, end: 0.8, value: "B" },
      { start: 0.8, end: 1, value: "X" },
    ],
  };
}

/** Writes a minimal valid character folder, then lets `mutate` break one thing. */
function minimal(dir, { mouthMode = "frame", mutate = () => {} } = {}) {
  rmSync(dir, { recursive: true, force: true });
  const files = {
    manifest: minimalManifest(mouthMode),
    anchor: { ...MINIMAL_ANCHOR },
    timing: minimalTiming(),
    // Overlay mouths are cropped to the anchor box.
    mouthSize:
      mouthMode === "overlay"
        ? [MW * MINIMAL_ANCHOR.w, MH * MINIMAL_ANCHOR.h]
        : [MW, MH],
    mouthAlpha: true,
    skip: new Set(),
  };
  mutate(files);
  writeJson(join(dir, "manifest.json"), files.manifest);
  writeJson(join(dir, "anchor.json"), files.anchor);
  writePng(join(dir, "portrait.png"), canvas(MW, MH, SKIN));
  Object.values(SHAPES).forEach((file, index) => {
    if (files.skip.has(file)) return;
    const [w, h] =
      typeof files.mouthSize === "function"
        ? files.mouthSize(file)
        : files.mouthSize;
    writePng(join(dir, file), canvas(w, h, [index * 30, 40, 60, 255]), {
      alpha: files.mouthAlpha,
    });
  });
  writeJson(join(dir, "lines", `${LINE_ID}.json`), files.timing);
  mkdirSync(join(dir, "lines"), { recursive: true });
  writeFileSync(
    join(dir, "lines", `${LINE_ID}.m4a`),
    "stand-in for an .m4a; the validator does not decode audio\n",
  );
}

const INVALID = {
  "missing-letter": (f) => {
    delete f.manifest.mouths.G;
  },
  "missing-file": (f) => {
    f.skip.add("mouths/FV.png");
  },
  "duplicate-line-id": (f) => {
    f.manifest.lines.push({ ...f.manifest.lines[0] });
  },
  "anchor-out-of-range": (f) => {
    f.anchor.x = 1.2;
  },
  "bad-cue-letter": (f) => {
    f.timing.mouthCues[1].value = "Z";
  },
  "overlapping-cues": (f) => {
    f.timing.mouthCues[2].start = 0.4;
  },
  "wrong-mouth-size": (f) => {
    f.mouthSize = (file) =>
      file === "mouths/AH.png" ? [MW / 2, MH / 2] : [MW, MH];
  },
  "unknown-mouth-mode": (f) => {
    f.manifest.mouthMode = "sprite";
  },
  "empty-caption-theme": (f) => {
    f.manifest.captionTheme = "";
  },
  "missing-text": (f) => {
    delete f.manifest.lines[0].text;
  },
  "id-mismatch": (f) => {
    f.manifest.id = "warden";
  },
  "absolute-path": (f) => {
    f.manifest.portrait = "/avatars/keeper/portrait.png";
  },
};

function makeMinimal() {
  minimal(join(FIXTURES, "minimal", "frame", "keeper"));
  minimal(join(FIXTURES, "minimal", "overlay", "keeper"), {
    mouthMode: "overlay",
  });
  rmSync(join(FIXTURES, "invalid"), { recursive: true, force: true });
  for (const [name, mutate] of Object.entries(INVALID)) {
    minimal(join(FIXTURES, "invalid", name, "keeper"), { mutate });
  }
  minimal(join(FIXTURES, "invalid", "overlay-no-alpha", "keeper"), {
    mouthMode: "overlay",
    mutate: (f) => {
      f.mouthAlpha = false;
    },
  });
  minimal(join(FIXTURES, "invalid", "overlay-wrong-size", "keeper"), {
    mouthMode: "overlay",
    mutate: (f) => {
      f.mouthSize = [MW, MH];
    },
  });
}

if (!skipAudio && !existsSync("/usr/bin/say")) {
  throw new Error(
    "Keeper audio needs macOS `say` and `afconvert`; use --skip-audio elsewhere.",
  );
}
makeKeeper();
makeMinimal();
console.log(`fixtures written to ${FIXTURES}`);
