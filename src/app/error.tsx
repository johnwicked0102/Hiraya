"use client";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="grid min-h-[70dvh] place-items-center p-6">
      <div className="card max-w-md p-8 text-center">
        <h1 className="h-display text-3xl">A gust of wind blew this page away</h1>
        <p className="mt-3 text-ink-soft">Something went wrong while loading. Your family&apos;s memories are safe — please try again.</p>
        <button onClick={reset} className="mt-6 inline-flex h-12 items-center rounded-2xl bg-forest px-6 font-bold text-[#fffaf0]">Try again</button>
      </div>
    </main>
  );
}
