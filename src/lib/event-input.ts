import { z } from "zod";
import { zText, zUuid } from "./http";

export const EventInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: zText(4000),
  kind: z.enum(["milestone", "reunion", "achievement", "historical", "celebration", "memorial", "custom"]).default("milestone"),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  datePrecision: z.enum(["day", "month", "year"]).default("day"),
  location: zText(200),
  recurring: z.boolean().default(false),
  mediaId: zUuid.nullable().optional(),
  people: z.array(zUuid).max(200).default([]),
});
