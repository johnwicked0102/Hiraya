"use client";
import { MediaGallery } from "@/components/media/media-gallery";
import { mediaUrl } from "@/lib/utils";
import type { Album, MediaItem, PersonLite } from "@/lib/types";

export function StoryMedia({ media, people, albums }: { media: MediaItem[]; people: PersonLite[]; albums: Album[] }) {
  const av = media.filter((m) => m.kind === "audio" || m.kind === "video");
  const rest = media.filter((m) => m.kind === "image" || m.kind === "document");
  return (
    <section className="mt-8 space-y-6">
      {av.map((m) => (
        <div key={m.id} className="card p-5">
          <p className="mb-3 font-display text-lg font-semibold">{m.title ?? m.fileName}</p>
          {m.kind === "audio" ? <audio src={mediaUrl(m.id)} controls preload="none" className="w-full" /> : <video src={mediaUrl(m.id)} controls preload="metadata" playsInline className="w-full rounded-2xl bg-black" />}
        </div>
      ))}
      {rest.length > 0 && <MediaGallery items={rest} people={people} albums={albums} />}
    </section>
  );
}
