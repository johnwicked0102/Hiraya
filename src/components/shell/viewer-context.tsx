"use client";
import { createContext, useContext } from "react";
import type { ViewerInfo } from "@/lib/types";

const Ctx = createContext<(ViewerInfo & { familyName: string; driveConnected: boolean }) | null>(null);

export function ViewerProvider({ value, children }: { value: ViewerInfo & { familyName: string; driveConnected: boolean }; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViewer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useViewer outside ViewerProvider");
  return v;
}
