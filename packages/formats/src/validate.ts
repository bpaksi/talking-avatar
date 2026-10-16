import { readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { z } from "zod";

import {
  type Anchor,
  type AvatarRule,
  anchorSchema,
  avatarManifestSchema,
  effectiveMouthMode,
  isAvatarRelativePath,
  MOUTH_MODES,
  type MouthMode,
} from "./avatar.js";
import { type PngInfo, readPngInfo } from "./png.js";
import { RHUBARB_LETTERS } from "./rhubarb.js";
import { rhubarbJsonSchema } from "./schemas.js";

export type AvatarIssue = {
  rule: AvatarRule;
  /** Path relative to the avatar folder, e.g. `manifest.json` or `lines/ts-keeper-001.json`. */
  file: string;
  lineId?: string;
  message: string;
};

const MANIFEST = "manifest.json";
// Overlay mouths are cropped to the anchor box; allow rounding of one pixel.
const OVERLAY_TOLERANCE_PX = 1;

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function ruleOf(issue: z.core.$ZodIssue, byKey: (key: unknown) => AvatarRule) {
  const param =
    issue.code === "custom"
      ? (issue.params as { rule?: AvatarRule } | undefined)?.rule
      : undefined;
  return param ?? byKey(issue.path[0]);
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.length === 0 ? "" : `${path.map(String).join(".")}: `;
}

const MANIFEST_RULES: Record<string, AvatarRule> = {
  mouths: 1,
  lines: 3,
  captionTheme: 7,
  mouthMode: 8,
  id: 9,
  portrait: 2,
  anchor: 2,
};

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Validates one character folder (`avatars/<id>/`) against asset contract v1
 * rules 1–10. Returns every problem found; an empty list means the folder is valid.
 */
export async function validateAvatar(dir: string): Promise<AvatarIssue[]> {
  const root = resolve(dir);
  const issues: AvatarIssue[] = [];
  const push = (issue: AvatarIssue) => issues.push(issue);

  const text = await readText(join(root, MANIFEST));
  if (text === null) {
    push({ rule: 2, file: MANIFEST, message: "manifest.json is missing" });
    return issues;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    push({
      rule: "schema",
      file: MANIFEST,
      message: `not valid JSON: ${(error as Error).message}`,
    });
    return issues;
  }
  if (!isRecord(raw)) {
    push({ rule: "schema", file: MANIFEST, message: "must be a JSON object" });
    return issues;
  }

  const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
  const lineIdAt = (index: unknown): string | undefined => {
    const line = typeof index === "number" ? rawLines[index] : undefined;
    return isRecord(line) ? str(line.line_id) : undefined;
  };

  // Rules 1, 3, 7, 8 (mode), 9 (type), 10 come from the schema.
  const parsed = avatarManifestSchema.safeParse(raw);
  for (const issue of parsed.success ? [] : parsed.error.issues) {
    const rule = ruleOf(
      issue,
      (key) => MANIFEST_RULES[String(key)] ?? "schema",
    );
    const lineId =
      issue.path[0] === "lines" ? lineIdAt(issue.path[1]) : undefined;
    push({
      rule,
      file: MANIFEST,
      ...(lineId === undefined ? {} : { lineId }),
      message: `${formatPath(issue.path)}${issue.message}`,
    });
  }

  // Rule 9: id equals the folder name.
  const id = str(raw.id);
  if (id !== undefined && id !== basename(root)) {
    push({
      rule: 9,
      file: MANIFEST,
      message: `id "${id}" does not equal the folder name "${basename(root)}"`,
    });
  }

  // Rule 2: every referenced file exists. Paths failing rule 10 are never touched.
  const usable = (path: unknown): path is string =>
    typeof path === "string" && isAvatarRelativePath(path);
  const exists = new Map<string, boolean>();
  const checkFile = async (path: unknown, lineId?: string) => {
    if (!usable(path)) return false;
    let found = exists.get(path);
    if (found === undefined) {
      found = await isFile(join(root, path));
      exists.set(path, found);
      if (!found) {
        push({
          rule: 2,
          file: path,
          ...(lineId === undefined ? {} : { lineId }),
          message: `${path} is referenced by manifest.json but does not exist`,
        });
      }
    }
    return found;
  };

  const portraitPath = raw.portrait;
  const portraitFound = await checkFile(portraitPath);
  const anchorPath = raw.anchor;
  const anchorFound = await checkFile(anchorPath);
  const mouths = isRecord(raw.mouths) ? raw.mouths : {};
  const mouthPaths = [
    ...new Set(RHUBARB_LETTERS.map((letter) => mouths[letter]).filter(usable)),
  ];
  const foundMouths: string[] = [];
  for (const path of mouthPaths) {
    if (await checkFile(path)) foundMouths.push(path);
  }

  // Rule 4: anchor values are fractions.
  let anchor: Anchor | undefined;
  if (anchorFound && usable(anchorPath)) {
    anchor = await readAnchor(root, anchorPath, push);
  }

  // Rules 5 and 6: timing files.
  for (const line of rawLines) {
    if (!isRecord(line)) continue;
    const lineId = str(line.line_id);
    await checkFile(line.audio, lineId);
    if (await checkFile(line.timing, lineId)) {
      await checkTiming(root, line.timing as string, lineId, push);
    }
  }

  // Rule 8: mouth image sizes for the effective mode. An unknown mode is
  // already reported by the schema and leaves nothing to size against.
  const mode = effectiveMouthMode(raw as { mouthMode?: MouthMode });
  if ((MOUTH_MODES as readonly unknown[]).includes(mode) && portraitFound) {
    await checkMouthSizes({
      root,
      mode,
      portraitPath: portraitPath as string,
      mouthPaths: foundMouths,
      anchor,
      push,
    });
  }

  return issues;
}

async function readAnchor(
  root: string,
  path: string,
  push: (issue: AvatarIssue) => void,
): Promise<Anchor | undefined> {
  let raw: unknown;
  try {
    raw = JSON.parse((await readText(join(root, path))) ?? "");
  } catch (error) {
    push({
      rule: "schema",
      file: path,
      message: `not valid JSON: ${(error as Error).message}`,
    });
    return undefined;
  }
  const parsed = anchorSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  for (const issue of parsed.error.issues) {
    push({
      rule: 4,
      file: path,
      message: `${formatPath(issue.path)}${issue.message}; anchor values are fractions in 0..1`,
    });
  }
  return undefined;
}

async function checkTiming(
  root: string,
  path: string,
  lineId: string | undefined,
  push: (issue: AvatarIssue) => void,
): Promise<void> {
  const withLine = lineId === undefined ? {} : { lineId };
  let raw: unknown;
  try {
    raw = JSON.parse((await readText(join(root, path))) ?? "");
  } catch (error) {
    push({
      rule: "schema",
      file: path,
      ...withLine,
      message: `not valid JSON: ${(error as Error).message}`,
    });
    return;
  }
  const parsed = rhubarbJsonSchema.safeParse(raw);
  for (const issue of parsed.success ? [] : parsed.error.issues) {
    const isLetter =
      issue.path[0] === "mouthCues" && issue.path.at(-1) === "value";
    push({
      rule: ruleOf(issue, () => (isLetter ? 5 : "schema")),
      file: path,
      ...withLine,
      message: `${formatPath(issue.path)}${issue.message}`,
    });
  }
}

async function readPng(
  root: string,
  path: string,
  push: (issue: AvatarIssue) => void,
): Promise<PngInfo | undefined> {
  const info = readPngInfo(new Uint8Array(await readFile(join(root, path))));
  if (info === null) {
    push({ rule: 8, file: path, message: `${path} is not a PNG` });
    return undefined;
  }
  return info;
}

async function checkMouthSizes(args: {
  root: string;
  mode: MouthMode;
  portraitPath: string;
  mouthPaths: readonly string[];
  anchor: Anchor | undefined;
  push: (issue: AvatarIssue) => void;
}): Promise<void> {
  const { root, mode, push } = args;
  const portrait = await readPng(root, args.portraitPath, push);
  if (portrait === undefined) return;
  for (const path of args.mouthPaths) {
    const mouth = await readPng(root, path, push);
    if (mouth === undefined) continue;
    if (mode === "frame") {
      if (mouth.width !== portrait.width || mouth.height !== portrait.height) {
        push({
          rule: 8,
          file: path,
          message: `frame mouth is ${mouth.width}x${mouth.height}; mouthMode "frame" needs the portrait size ${portrait.width}x${portrait.height}`,
        });
      }
      continue;
    }
    if (!mouth.hasAlpha) {
      push({
        rule: 8,
        file: path,
        message: 'mouthMode "overlay" needs a transparent PNG',
      });
    }
    if (args.anchor === undefined) continue;
    const width = Math.round(args.anchor.w * portrait.width);
    const height = Math.round(args.anchor.h * portrait.height);
    if (
      Math.abs(mouth.width - width) > OVERLAY_TOLERANCE_PX ||
      Math.abs(mouth.height - height) > OVERLAY_TOLERANCE_PX
    ) {
      push({
        rule: 8,
        file: path,
        message: `overlay mouth is ${mouth.width}x${mouth.height}; the anchor box is ${width}x${height}`,
      });
    }
  }
}
