import { requireViewer } from "@/lib/session";
import { sql } from "@/lib/db";
import { loadTree } from "@/lib/family";
import { CapsulesView, type Capsule } from "./capsules-view";

export const metadata = { title: "Time Capsules" };

export default async function CapsulesPage() {
  const viewer = await requireViewer();
  const rows = await sql<(Capsule & { message: string | null })[]>`
    select t.id, t.title, t.unlock_at, t.audience, t.author_id, t.created_at, a.display_name as author_name,
      (t.unlock_at <= now()) as is_open,
      case when t.unlock_at <= now() or t.author_id = ${viewer.accountId} then t.message else null end as message,
      coalesce((select array_agg(cr.person_id::text) from capsule_recipients cr where cr.capsule_id = t.id), '{}') as recipients,
      case when t.unlock_at <= now() or t.author_id = ${viewer.accountId}
        then coalesce((select array_agg(cm.media_id::text) from capsule_media cm join media m on m.id = cm.media_id and m.deleted_at is null where cm.capsule_id = t.id), '{}')
        else '{}' end as media,
      (select count(*)::int from capsule_media cm where cm.capsule_id = t.id) as media_count
    from time_capsules t left join accounts a on a.id = t.author_id
    where t.audience = 'family'
       or t.author_id = ${viewer.accountId}
       or ${viewer.isAdmin}
       or exists (select 1 from capsule_recipients cr where cr.capsule_id = t.id and cr.person_id = ${viewer.personId})
    order by t.unlock_at`;
  const tree = await loadTree();
  return <CapsulesView capsules={rows} people={tree.persons} />;
}
