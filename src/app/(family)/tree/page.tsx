import { loadTree } from "@/lib/family";
import { getSettings } from "@/lib/settings";
import { FamilyTree } from "@/components/tree/family-tree";

export const metadata = { title: "Family Tree" };

export default async function TreePage({ searchParams }: { searchParams: Promise<{ person?: string }> }) {
  const [tree, settings, sp] = await Promise.all([loadTree(), getSettings(), searchParams]);
  const zoomTo = sp.person && tree.persons.some((p) => p.id === sp.person) ? sp.person : null;
  return <FamilyTree key={zoomTo ?? ""} initial={tree} rootPersonId={settings.rootPersonId} zoomTo={zoomTo} />;
}
