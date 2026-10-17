"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/client";

export function DeleteStoryButton({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <Button variant="ghost" size="sm" className="text-danger" onClick={async () => {
      if (!confirm("Delete this story? Attached photos and recordings stay in the Memory Garden.")) return;
      try { await api(`/api/stories/${id}`, { method: "DELETE" }); toast("Story removed"); router.replace("/stories"); router.refresh(); }
      catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't delete", "error"); }
    }}><Trash2 /> Delete</Button>
  );
}
