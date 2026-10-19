"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, CircleAlert } from "lucide-react";

type Toast = { id: number; message: string; tone: "ok" | "error" };
const ToastCtx = React.createContext<(message: string, tone?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const push = React.useCallback((message: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, message, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="card pointer-events-auto flex max-w-md items-center gap-3 px-5 py-3.5 font-semibold"
              role={t.tone === "error" ? "alert" : "status"}
            >
              {t.tone === "ok" ? <CheckCircle2 className="size-5 shrink-0 text-forest" /> : <CircleAlert className="size-5 shrink-0 text-danger" />}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => React.useContext(ToastCtx);
