import { loadTree } from "@/lib/family";
import { getSettings } from "@/lib/settings";
import { FamilyTree } from "@/components/tree/family-tree";

export const metadata = { title: "Family Tree" };

export default async function TreePage() {
  const [tree, settings] = await Promise.all([loadTree(), getSettings()]);
  return <FamilyTree initial={tree} rootPersonId={settings.rootPersonId} />;
}
