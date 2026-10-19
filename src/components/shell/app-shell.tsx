"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  House, GitFork, Flower2, Milestone, BookOpen, Hourglass, CalendarHeart, ShieldCheck, LogOut, Menu, X, Settings2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn, mediaUrl } from "@/lib/utils";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./preferences";
import { useViewer } from "./viewer-context";
import { api } from "@/lib/client";

const NAV = [
  { href: "/home", label: "Home", icon: House },
  { href: "/tree", label: "Family Tree", icon: GitFork },
  { href: "/memories", label: "Memory Garden", icon: Flower2 },
  { href: "/timeline", label: "Timeline", icon: Milestone },
  { href: "/stories", label: "Stories", icon: BookOpen },
  { href: "/capsules", label: "Time Capsules", icon: Hourglass },
  { href: "/calendar", label: "Celebrations", icon: CalendarHeart },
];
const MOBILE_PRIMARY = ["/home", "/tree", "/memories", "/stories"];

export function AppShell({ children, familyName, logoMediaId }: { children: React.ReactNode; familyName: string; logoMediaId: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const viewer = useViewer();
  const [more, setMore] = useState(false);
  const active = (href: string) => path === href || path.startsWith(href + "/");

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const extra = [
    ...NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href)),
    ...(viewer.role === "admin" ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
    { href: "/account", label: "My settings", icon: Settings2 },
  ];

  return (
    <div className="min-h-dvh pb-24 lg:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/home" className="flex items-center gap-2.5 rounded-2xl pr-2">
            {logoMediaId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(logoMediaId, { thumb: 96 })} alt="" className="size-10 rounded-full border-2 border-gold object-cover" />
            ) : (
              <LogoMark />
            )}
            <span className="flex flex-col leading-none">
              <span className="h-display text-xl">Hiraya</span>
              <span className="mt-0.5 hidden text-xs font-semibold text-ink-soft sm:block lg:hidden xl:block">The {familyName} family</span>
            </span>
          </Link>
          {/* Compact between lg and xl so all seven labels fit on one line at 1024px. */}
          <nav className="ml-2 hidden flex-1 items-center gap-0.5 lg:flex xl:ml-4 xl:gap-1" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
                className={cn("relative whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-bold transition xl:px-3 xl:text-[0.95rem]", active(n.href) ? "text-forest-deep" : "text-ink-soft hover:text-ink")}>
                {active(n.href) && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-xl bg-meadow/30" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {viewer.role === "admin" && (
              <Link href="/admin" title="Admin" className={cn("hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold md:flex", active("/admin") ? "bg-gold/25 text-ink" : "text-ink-soft hover:text-ink")}>
                <ShieldCheck className="size-4" /> <span className="lg:sr-only xl:not-sr-only">Admin</span>
              </Link>
            )}
            <ThemeToggle />
            <Link href="/account" className="hidden size-11 place-items-center rounded-2xl text-ink-soft hover:bg-surface-2 hover:text-ink md:grid" aria-label="My settings" title="My settings">
              <Settings2 className="size-5" />
            </Link>
            <button onClick={logout} className="hidden size-11 place-items-center rounded-2xl text-ink-soft hover:bg-surface-2 hover:text-ink md:grid" aria-label="Sign out" title="Sign out">
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="relative">{children}</main>

      {/* Phone & tablet bottom navigation (the top nav only fits from lg up): large targets for every age */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Main">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[0.7rem] font-bold", active(n.href) ? "text-forest" : "text-ink-faint")}>
              <n.icon className="size-6" />
              {n.label.split(" ")[0]}
            </Link>
          ))}
          <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[0.7rem] font-bold text-ink-faint">
            <Menu className="size-6" /> More
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {more && (
          <motion.div className="fixed inset-0 z-50 bg-black/35 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.div
              className="card absolute inset-x-2 bottom-2 mx-auto max-w-lg p-4"
              initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="h-display text-xl">More</span>
                <button onClick={() => setMore(false)} className="rounded-full p-2" aria-label="Close"><X /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {extra.map((n) => (
                  <Link key={n.href} href={n.href} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 font-bold">
                    <n.icon className="size-5 text-forest" /> {n.label}
                  </Link>
                ))}
                <button onClick={logout} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 font-bold text-danger">
                  <LogOut className="size-5" /> Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-sm font-extrabold uppercase tracking-[0.14em] text-moss">{eyebrow}</p>}
        <h1 className="h-display text-4xl text-ink sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-lg text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10", className)}>{children}</div>;
}
