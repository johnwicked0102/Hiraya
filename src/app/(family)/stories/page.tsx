import { listStories } from "@/lib/stories";
import { loadTree } from "@/lib/family";
import { StoriesList } from "./stories-list";

export const metadata = { title: "Stories & Legacy" };

export default async function StoriesPage() {
  const [stories, tree] = await Promise.all([listStories(), loadTree()]);
  return <StoriesList stories={stories} people={tree.persons} />;
}
