export const REQUIRED_SHAPES = [
  "REST",
  "MBP",
  "CONS/EE",
  "EH/AE",
  "AH",
  "OH/ER",
  "OO/W",
  "FV",
] as const;

export const OPTIONAL_SHAPES = ["L", "TH"] as const;

export const SHAPE_IDS = [...REQUIRED_SHAPES, ...OPTIONAL_SHAPES] as const;

export type ShapeId = (typeof SHAPE_IDS)[number];

export function isShapeId(value: string): value is ShapeId {
  return (SHAPE_IDS as readonly string[]).includes(value);
}
