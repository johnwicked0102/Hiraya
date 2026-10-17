import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { loadTree } from "@/lib/family";
import { getStory } from "@/lib/stories";
import { StoryEditor } from "@/components/heritage/story-editor";

export const metadata = { title: "Edit story" };

export default async function EditStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const story = await getStory(id);
  if (!story) notFound();
  if (!viewer.canEditTree && story.authorId !== viewer.accountId) redirect(`/stories/${id}`);
  const tree = await loadTree();
  return <StoryEditor people={tree.persons} initial={story} />;
}
