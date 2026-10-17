import { celebrationSources, todayLocal } from "@/lib/celebrations";
import { loadTree } from "@/lib/family";
import { CalendarView } from "./calendar-view";

export const metadata = { title: "Family Celebrations" };

export default async function CalendarPage() {
  const [sources, tree] = await Promise.all([celebrationSources(), loadTree()]);
  return <CalendarView sources={sources} people={tree.persons} today={todayLocal()} />;
}
