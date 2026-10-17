import { z } from "zod";
import { zDate, zUuid } from "./http";

export const StoryInput = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(["story", "memory", "recipe", "tradition", "letter", "interview", "lesson"]).default("story"),
  body: z.string().max(100_000).default(""),
  storyDate: zDate,
  coverMediaId: zUuid.nullable().optional(),
  people: z.array(zUuid).max(200).default([]),
  media: z.array(zUuid).max(100).default([]),
});
