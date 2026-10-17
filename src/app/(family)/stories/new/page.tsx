import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { loadTree } from "@/lib/family";
import { StoryEditor } from "@/components/heritage/story-editor";

export const metadata = { title: "Write a story" };

export default async function NewStoryPage() {
  const viewer = await requireViewer();
  if (!viewer.canContribute) redirect("/stories");
  const tree = await loadTree();
  return <StoryEditor people={tree.persons} />;
}
