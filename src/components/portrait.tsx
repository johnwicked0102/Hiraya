import type { Crop, Frame, PersonLite } from "@/lib/types";
import { cn, initials, mediaUrl } from "@/lib/utils";

/**
 * Displays a person's portrait using a non-destructive crop of the original photo.
 * The crop is stored as percentages of the original image, so the original file
 * in Google Drive is never modified.
 */
export function Portrait({
  person, size = 96, frame, crop, mediaId, className, thumb,
}: {
  person: Pick<PersonLite, "firstName" | "lastName" | "gender" | "isDeceased"> & Partial<Pick<PersonLite, "photoMediaId" | "photoCrop" | "photoFrame">>;
  size?: number;
  frame?: Frame;
  crop?: Crop | null;
  mediaId?: string | null;
  className?: string;
  thumb?: number;
}) {
  const f = frame ?? person.photoFrame ?? "round";
  const m = mediaId !== undefined ? mediaId : person.photoMediaId;
  const c = crop !== undefined ? crop : person.photoCrop;
  const h = f === "storybook" || f === "oval" ? Math.round(size * 1.18) : size;
  const tint = person.gender === "female" ? "var(--rose)" : person.gender === "male" ? "var(--sky-deep)" : "var(--moss)";
  const style: React.CSSProperties = { width: size, height: h };

  let img: React.ReactNode = null;
  if (m) {
    const src = mediaUrl(m, { thumb: thumb ?? (size > 160 ? 800 : 400) });
    if (c && c.width > 0 && c.height > 0) {
      img = (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute max-w-none select-none"
          style={{
            width: `${(100 / c.width) * 100}%`,
            height: `${(100 / c.height) * 100}%`,
            left: `${-(c.x / c.width) * 100}%`,
            top: `${-(c.y / c.height) * 100}%`,
          }}
        />
      );
    } else {
      // eslint-disable-next-line @next/next/no-img-element
      img = <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />;
    }
  }

  return (
    <div className={cn("frame shrink-0", `frame-${f}`, person.isDeceased && "memorial", className)} style={style}>
      {img ?? (
        <div className="grid h-full w-full place-items-center font-display font-semibold text-white"
          style={{ background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${tint} 70%, white), ${tint})`, fontSize: size * 0.34 }}>
          {initials(person)}
        </div>
      )}
      {f === "polaroid" && <div className="absolute inset-x-0 bottom-0 h-[14%] bg-[#fffdf7]" />}
    </div>
  );
}
