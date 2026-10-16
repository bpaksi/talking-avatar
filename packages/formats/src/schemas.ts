import { z } from "zod";

import { estimateLineSeconds, MAX_LINE_SECONDS } from "./captions.js";
import { PauseMarkupError, parseLineText } from "./pause.js";
import { RHUBARB_LETTERS } from "./rhubarb.js";
import { SHAPE_IDS } from "./shapes.js";

export const shapeIdSchema = z.enum(SHAPE_IDS);

export const cueSchema = z.object({
  time: z.number().nonnegative(),
  shape: shapeIdSchema,
});

export const wordSchema = z
  .object({
    word: z.string().min(1),
    start: z.number().nonnegative(),
    end: z.number().nonnegative(),
  })
  .refine((word) => word.end >= word.start, {
    message: "word end is before start",
  });

export const overridesSchema = z
  .strictObject({
    cues: z.array(cueSchema).default([]),
    remove: z.array(z.number().nonnegative()).default([]),
  })
  .transform((value) => ({ cues: value.cues, remove: value.remove }));

export const lineJsonSchema = z
  .object({
    lineId: z.string().min(1),
    text: z.string(),
    audio: z.string().min(1).nullable(),
    cues: z.array(cueSchema),
    words: z.array(wordSchema),
    captionTiming: z.enum(["whisper", "fallback"]),
  })
  .superRefine((line, ctx) => {
    for (let index = 1; index < line.cues.length; index += 1) {
      const previous = line.cues[index - 1];
      const current = line.cues[index];
      if (
        previous !== undefined &&
        current !== undefined &&
        current.time <= previous.time
      ) {
        ctx.addIssue({
          code: "custom",
          message: "cues must be strictly increasing by time",
          path: ["cues", index, "time"],
        });
      }
    }
    try {
      parseLineText(line.text);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message:
          error instanceof PauseMarkupError
            ? error.message
            : "Invalid pause markup",
        path: ["text"],
      });
    }
    if (line.audio === null && line.captionTiming !== "fallback") {
      ctx.addIssue({
        code: "custom",
        message: "caption-only lines use fallback timing",
        path: ["captionTiming"],
      });
    }
    if (line.audio === null && line.cues.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "caption-only lines have no mouth cues",
        path: ["cues"],
      });
    }
  });

export const rhubarbJsonSchema = z.object({
  metadata: z.object({
    soundFile: z.string(),
    duration: z.number().nonnegative(),
  }),
  mouthCues: z
    .array(
      z.object({
        start: z.number().nonnegative(),
        end: z.number().nonnegative(),
        value: z.enum(RHUBARB_LETTERS),
      }),
    )
    .superRefine((cues, ctx) => {
      // Asset contract rule 6: in order, no overlap.
      cues.forEach((cue, index) => {
        if (cue.end < cue.start) {
          ctx.addIssue({
            code: "custom",
            message: `cue ${index} ends before it starts`,
            path: [index, "end"],
            params: { rule: 6 },
          });
        }
        const previous = cues[index - 1];
        if (previous !== undefined && cue.start < previous.end) {
          ctx.addIssue({
            code: "custom",
            message: `cue ${index} starts at ${cue.start} before cue ${index - 1} ends at ${previous.end}`,
            path: [index, "start"],
            params: { rule: 6 },
          });
        }
      });
    }),
});

export const mouthsSchema = z.strictObject({
  REST: z.string().min(1),
  MBP: z.string().min(1),
  "CONS/EE": z.string().min(1),
  "EH/AE": z.string().min(1),
  AH: z.string().min(1),
  "OH/ER": z.string().min(1),
  "OO/W": z.string().min(1),
  FV: z.string().min(1),
  L: z.string().min(1).optional(),
  TH: z.string().min(1).optional(),
});

export const castSchema = z.record(
  z.string().min(1),
  z.strictObject({
    voice: z.strictObject({
      provider: z.string().min(1),
      voiceId: z.string().min(1),
      style: z.string().optional(),
    }),
    portrait: z.string().min(1),
    mouths: mouthsSchema,
    anchor: z.strictObject({
      x: z.number().finite(),
      y: z.number().finite(),
    }),
    captionTheme: z.string().min(1).optional(),
  }),
);

export const scriptSchema = z
  .strictObject({
    id: z.string().min(1),
    lines: z.array(
      z.strictObject({
        id: z.string().min(1),
        speaker: z.string().min(1),
        note: z.string().optional(),
        text: z.string(),
      }),
    ),
  })
  .superRefine((script, ctx) => {
    script.lines.forEach((line, index) => {
      try {
        parseLineText(line.text);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          message:
            error instanceof PauseMarkupError
              ? error.message
              : "Invalid pause markup",
          path: ["lines", index, "text"],
        });
        return;
      }
      if (estimateLineSeconds(line.text) > MAX_LINE_SECONDS) {
        ctx.addIssue({
          code: "custom",
          message: "estimated duration is greater than 20 s",
          path: ["lines", index, "text"],
        });
      }
    });
  });

export type LineJson = z.infer<typeof lineJsonSchema>;
export type CastFile = z.infer<typeof castSchema>;
export type ScriptFile = z.infer<typeof scriptSchema>;
