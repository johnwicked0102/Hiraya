"use client";
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import { ChevronDown, ChevronUp, Heart, Flower } from "lucide-react";
import { Portrait } from "@/components/portrait";
import { cn, fullName, formatDate, yearOf } from "@/lib/utils";
import { PERSON_H, PERSON_W, type PersonNodeData } from "./layout";
import type { Partnership } from "@/lib/types";

export const PersonNode = memo(function PersonNode({ data, selected }: NodeProps) {
  const d = data as PersonNodeData;
  const p = d.person;
  const onToggle = (d as unknown as { onToggle?: (id: string) => void }).onToggle;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 18, delay: Math.min(d.generation * 0.06, 0.4) }}
      style={{ width: PERSON_W, height: PERSON_H }}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center rounded-[1.6rem] px-2 pb-2 pt-3 text-center transition",
        "border bg-surface/95 backdrop-blur-sm",
        selected ? "border-gold shadow-[0_0_0_4px_var(--ring),0_18px_30px_-16px_rgb(var(--shadow)/.6)]" : "border-line shadow-[0_14px_26px_-18px_rgb(var(--shadow)/.55)] hover:-translate-y-0.5",
        p.isDeceased && "memorial",
      )}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {d.isFocus && <span className="absolute -top-2.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#2c2310]">Focus</span>}
      {d.isSelf && !d.isFocus && <span className="absolute -top-2.5 rounded-full bg-forest px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">You</span>}
      <Portrait person={p} size={88} thumb={240} />
      <div className="mt-2.5 w-full px-1">
        <p className="line-clamp-2 font-display text-[0.98rem] font-semibold leading-tight text-ink">{fullName(p)}</p>
        {p.birthDate && (
          <p className="mt-1 text-[0.72rem] font-semibold leading-tight text-ink-soft">
            Born {formatDate(p.birthDate, p.birthDatePrecision, "short")}
          </p>
        )}
        {p.isDeceased ? (
          <p className="mt-1 flex items-center justify-center gap-1 text-[0.72rem] font-bold leading-tight text-moss">
            <Flower className="size-3 shrink-0" aria-hidden />
            {yearOf(p.deathDate) ? `In loving memory · ${yearOf(p.deathDate)}` : "In loving memory"}
          </p>
        ) : (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[0.72rem] font-bold leading-tight text-forest">
            <span className="size-2 shrink-0 rounded-full bg-forest" aria-hidden />
            Living
          </p>
        )}
      </div>
      {d.childCount > 0 && onToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(p.id);
          }}
          className="nodrag absolute -bottom-3.5 left-1/2 flex h-7 -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[11px] font-extrabold text-ink-soft shadow-sm hover:text-ink"
          aria-label={d.collapsed ? `Show ${d.childCount} children` : "Fold this branch"}
          title={d.collapsed ? "Unfold branch" : "Fold branch"}
        >
          {d.collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          {d.collapsed ? d.childCount : ""}
        </button>
      )}
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </motion.div>
  );
});

export const UnionNode = memo(function UnionNode({ data }: NodeProps) {
  const p = (data as { partnership: Partnership | null }).partnership;
  const ended = p && p.status !== "current";
  return (
    <div className="relative grid size-[18px] place-items-center" title={p ? `${p.kind}${ended ? ` (${p.status})` : ""}` : "Parents"}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {p ? (
        <Heart className={cn("size-[18px]", ended ? "fill-surface text-ink-faint" : "fill-rose text-rose")} />
      ) : (
        <span className="size-2.5 rounded-full bg-forest" />
      )}
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
});
