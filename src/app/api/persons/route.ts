import { z } from "zod";
import { api, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { loadTree } from "@/lib/family";
import { PersonInput, RelationInput } from "@/lib/person-input";
import { logActivity } from "@/lib/activity";
import { fullName } from "@/lib/utils";

export const GET = api({ level: "member" }, async () => loadTree());

const PARENT_KINDS = ["biological", "adopted", "step", "foster", "guardian"];

export const POST = api(
  { level: "editor", body: z.object({ person: PersonInput, relation: RelationInput.optional() }) },
  async ({ viewer, body }) => {
    const p = body.person;
    const rel = body.relation;
    const id = await sql.begin(async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into persons (first_name, middle_name, last_name, maiden_name, nickname, gender, birth_date, birth_date_precision,
          birth_place, is_deceased, death_date, death_date_precision, death_place, resting_place, occupation, hobbies,
          achievements, biography, memorial_message, photo_media_id, photo_crop, photo_frame, cover_media_id, sensitive, created_by)
        values (${p.firstName}, ${p.middleName}, ${p.lastName}, ${p.maidenName}, ${p.nickname}, ${p.gender}, ${p.birthDate},
          ${p.birthDatePrecision}, ${p.birthPlace}, ${p.isDeceased}, ${p.deathDate}, ${p.deathDatePrecision}, ${p.deathPlace},
          ${p.restingPlace}, ${p.occupation}, ${p.hobbies}, ${p.achievements}, ${p.biography}, ${p.memorialMessage},
          ${p.photoMediaId ?? null}, ${p.photoCrop ? tx.json(p.photoCrop) : null}, ${p.photoFrame}, ${p.coverMediaId ?? null},
          ${tx.json(p.sensitive ?? {})}, ${viewer.accountId})
        returning id`;
      const newId = row!.id;
      if (rel) {
        const [target] = await tx`select id from persons where id = ${rel.personId} and deleted_at is null`;
        if (!target) throw new HttpError(404, "The relative you chose no longer exists.");
        const kind = rel.kind && PARENT_KINDS.includes(rel.kind) ? rel.kind : "biological";
        if (rel.type === "parent") {
          // new person is a parent of target
          await tx`insert into parent_child (parent_id, child_id, kind) values (${newId}, ${rel.personId}, ${kind})`;
        } else if (rel.type === "child") {
          await tx`insert into parent_child (parent_id, child_id, kind) values (${rel.personId}, ${newId}, ${kind})`;
        } else if (rel.type === "partner") {
          const pk = rel.kind && ["married", "partner", "engaged"].includes(rel.kind) ? rel.kind : "married";
          await tx`insert into partnerships (person_a, person_b, kind) values (${rel.personId}, ${newId}, ${pk})`;
        } else if (rel.type === "sibling") {
          const parents = await tx<{ parentId: string; kind: string }[]>`select parent_id, kind from parent_child where child_id = ${rel.personId}`;
          if (!parents.length) throw new HttpError(400, "Add a parent to that person first so the siblings share a branch.");
          for (const par of parents) {
            await tx`insert into parent_child (parent_id, child_id, kind) values (${par.parentId}, ${newId}, ${par.kind === "step" ? "step" : kind})`;
          }
        }
      }
      return newId;
    });
    await logActivity({
      accountId: viewer.accountId, action: "person.created", entityType: "person", entityId: id,
      summary: `Added ${fullName(p)}${rel ? ` (${rel.type})` : ""}`,
    });
    return { id };
  },
);

