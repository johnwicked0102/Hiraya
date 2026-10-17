import { z } from "zod";
import { zDate, zText, zUuid } from "./http";

export const CropSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
});

export const PersonInput = z.object({
  firstName: z.string().trim().min(1).max(120),
  middleName: zText(120),
  lastName: zText(120),
  maidenName: zText(120),
  nickname: zText(80),
  gender: z.enum(["female", "male", "other", "unknown"]).default("unknown"),
  birthDate: zDate,
  birthDatePrecision: z.enum(["day", "month", "year"]).default("day"),
  birthPlace: zText(200),
  isDeceased: z.boolean().default(false),
  deathDate: zDate,
  deathDatePrecision: z.enum(["day", "month", "year"]).default("day"),
  deathPlace: zText(200),
  restingPlace: zText(200),
  occupation: zText(200),
  hobbies: zText(500),
  achievements: zText(2000),
  biography: zText(20000),
  memorialMessage: zText(2000),
  photoMediaId: zUuid.nullable().optional(),
  photoCrop: CropSchema.nullable().optional(),
  photoFrame: z.enum(["round", "storybook", "leaf", "polaroid", "oval"]).default("round"),
  coverMediaId: zUuid.nullable().optional(),
  sensitive: z
    .object({ phone: zText(60), email: zText(200), address: zText(500), notes: zText(2000) })
    .partial()
    .optional(),
});

export type PersonInputT = z.infer<typeof PersonInput>;

export const RelationInput = z.object({
  type: z.enum(["parent", "child", "partner", "sibling"]),
  personId: zUuid,
  kind: z.string().max(20).optional(),
});
