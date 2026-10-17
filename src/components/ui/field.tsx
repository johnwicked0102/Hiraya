import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-2xl border border-line bg-surface px-4 text-ink placeholder:text-ink-faint shadow-[inset_0_1px_2px_rgb(0_0_0/.04)] transition focus:border-gold focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(control, "h-12", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(control, "min-h-28 py-3 leading-relaxed", className)} {...props} />,
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(control, "h-12 appearance-none pr-10", className)}
      style={{ backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", backgroundSize: "14px", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%238b9583'><path d='M5 7l5 6 5-6z'/></svg>\")" }}
      {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = React.useId();
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id: (children.props as { id?: string }).id ?? id })
    : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-bold tracking-wide text-ink-soft">
        {label}
      </label>
      {child}
      {hint && <p className="text-sm text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = "moss", className }: { children: React.ReactNode; tone?: "moss" | "gold" | "sky" | "rose" | "ink"; className?: string }) {
  const tones = {
    moss: "bg-meadow/30 text-forest-deep",
    gold: "bg-sun/50 text-[#6b4a0c] dark:text-sun dark:bg-gold/20",
    sky: "bg-sky/40 text-[#24506b] dark:text-sky-deep",
    rose: "bg-rose/25 text-[#8a3e2f] dark:text-rose",
    ink: "bg-ink/10 text-ink-soft",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone], className)}>{children}</span>;
}

export function Checkbox({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl py-1 text-ink">
      <input type="checkbox" className="size-5 rounded-md accent-[var(--forest)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
