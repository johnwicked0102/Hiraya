import { buildTimeline } from "@/lib/timeline";
import { TimelineView } from "./timeline-view";

export const metadata = { title: "Family Timeline" };

export default async function TimelinePage() {
  const data = await buildTimeline();
  return <TimelineView {...data} />;
}
