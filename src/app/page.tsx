import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Index() {
  redirect((await getViewer()) ? "/home" : "/login");
}
