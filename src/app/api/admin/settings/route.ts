import { z } from "zod";
import { api } from "@/lib/http";
import { setSetting } from "@/lib/settings";
import { zUuid } from "@/lib/http";
import { logActivity } from "@/lib/activity";

export const PATCH = api(
  {
    level: "admin",
    body: z.object({
      familyName: z.string().trim().min(1).max(120).optional(),
      familyMotto: z.string().trim().max(300).optional(),
      logoMediaId: zUuid.nullable().optional(),
      featuredMediaId: zUuid.nullable().optional(),
      viewersCanContribute: z.boolean().optional(),
      membersCanDownload: z.boolean().optional(),
      rootPersonId: zUuid.nullable().optional(),
    }),
  },
  async ({ viewer, body }) => {
    const map = {
      familyName: "family_name", familyMotto: "family_motto", logoMediaId: "logo_media_id", featuredMediaId: "featured_media_id",
      viewersCanContribute: "viewers_can_contribute", membersCanDownload: "members_can_download", rootPersonId: "root_person_id",
    } as const;
    for (const [k, v] of Object.entries(body)) if (v !== undefined) await setSetting(map[k as keyof typeof map], v);
    await logActivity({ accountId: viewer.accountId, action: "settings.updated", summary: `Changed family settings (${Object.keys(body).join(", ")})` });
    return { ok: true };
  },
);
