import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { loadTree } from "@/lib/family";
import { getStory } from "@/lib/stories";
import { listAlbums } from "@/lib/queries";
import { Page } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Portrait } from "@/components/portrait";
import { KIND_LABELS } from "@/lib/story-kinds";
import { DeleteStoryButton } from "./delete-button";
import { StoryMedia } from "./story-media";
import { formatDate, fullName, mediaUrl, timeAgo } from "@/lib/utils";

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [story, tree, albums] = await Promise.all([getStory(id), loadTree(), listAlbums()]);
  if (!story) notFound();
  const k = KIND_LABELS[story.kind] ?? KIND_LABELS.story!;
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const canEdit = viewer.canEditTree || story.authorId === viewer.accountId;
  return (
    <Page className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild><Link href="/stories"><ArrowLeft /> All stories</Link></Button>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" asChild><Link href={`/stories/${id}/edit`}><Pencil /> Edit</Link></Button>
            <DeleteStoryButton id={id} />
          </div>
        )}
      </div>
      <article className="card overflow-hidden">
        {story.coverMediaId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(story.coverMediaId, { thumb: 1400 })} alt="" className="max-h-[420px] w-full object-cover" />
        )}
        <div className="p-6 sm:p-10">
          <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-moss">{k.emoji} {k.label}{story.storyDate ? ` · ${formatDate(story.storyDate)}` : ""}</p>
          <h1 className="h-display mt-2 text-4xl sm:text-5xl">{story.title}</h1>
          <p className="mt-3 text-ink-faint">Preserved by {story.authorName ?? "a family member"} · {timeAgo(story.createdAt)}</p>
          {story.people.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {story.people.map((pid) => {
                const p = byId.get(pid);
                return p ? (
                  <Link key={pid} href={`/people/${pid}`} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 font-bold hover:bg-meadow/30">
                    <Portrait person={p} size={30} thumb={96} frame="round" className="!shadow-none" /> {fullName(p)}
                  </Link>
                ) : null;
              })}
            </div>
          )}
          <div className="prose-story mt-8 font-display text-[1.18rem] leading-[1.85]">
            {story.body.split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
          </div>
        </div>
      </article>
      {story.media.length > 0 && <StoryMedia media={story.media} people={tree.persons} albums={albums} />}
    </Page>
  );
}
