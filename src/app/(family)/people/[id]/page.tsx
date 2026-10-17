import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getPerson, loadTree, mediaForPerson } from "@/lib/family";
import { listAlbums } from "@/lib/queries";
import { sql } from "@/lib/db";
import { ProfileView } from "./profile-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Family member" };
  const [p] = await sql<{ firstName: string; lastName: string | null }[]>`select first_name, last_name from persons where id = ${id}`;
  return { title: p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : "Family member" };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const person = await getPerson(id, viewer);
  if (!person) notFound();
  const [tree, media, albums, stories, events, greetings] = await Promise.all([
    loadTree(),
    mediaForPerson(id),
    listAlbums(),
    sql<{ id: string; title: string; kind: string; createdAt: string; authorName: string | null }[]>`
      select s.id, s.title, s.kind, s.created_at, a.display_name as author_name
      from stories s join story_people sp on sp.story_id = s.id and sp.person_id = ${id}
      left join accounts a on a.id = s.author_id order by s.created_at desc`,
    sql<{ id: string; title: string; eventDate: string; datePrecision: "day" | "month" | "year"; kind: string; description: string | null }[]>`
      select e.id, e.title, e.event_date, e.date_precision, e.kind, e.description
      from events e join event_people ep on ep.event_id = e.id and ep.person_id = ${id} order by e.event_date`,
    sql<{ id: string; message: string; cardStyle: string; occasion: string; year: number; createdAt: string; authorName: string | null; authorId: string | null }[]>`
      select g.id, g.message, g.card_style, g.occasion, g.year, g.created_at, a.display_name as author_name, g.author_id
      from greetings g left join accounts a on a.id = g.author_id
      where g.person_id = ${id} order by g.created_at desc limit 40`,
  ]);
  return (
    <ProfileView person={person} tree={tree} media={media} albums={albums} stories={stories} events={events} greetings={greetings} />
  );
}
