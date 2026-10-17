import { requireViewer } from "@/lib/session";
import { listAlbums, listMedia } from "@/lib/queries";
import { loadTree } from "@/lib/family";
import { MemoryGarden } from "./garden";

export const metadata = { title: "Memory Garden" };

export default async function MemoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const k of ["album", "person", "kind", "year", "q"]) if (sp[k]) params.set(k, sp[k]!);
  const [media, albums, tree] = await Promise.all([listMedia(params, viewer.accountId), listAlbums(), loadTree()]);
  return <MemoryGarden initial={media} albums={albums} people={tree.persons} initialFilters={Object.fromEntries(params)} />;
}
