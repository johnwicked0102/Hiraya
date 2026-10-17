import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-forest text-[#fffaf0] dark:text-[#14211a] shadow-[0_8px_18px_-10px_rgb(43_77_49/.8)] hover:bg-forest-deep hover:-translate-y-px",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2 hover:-translate-y-px",
  ghost: "text-ink-soft hover:text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
  gold: "bg-gold text-[#2c2310] shadow-[0_8px_18px_-10px_rgb(180_120_30/.8)] hover:brightness-105 hover:-translate-y-px",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl gap-1.5",
  md: "h-11 px-5 rounded-2xl gap-2",
  lg: "h-14 px-7 text-lg rounded-2xl gap-2.5",
  icon: "h-11 w-11 rounded-2xl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex select-none items-center justify-center font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
            )}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
