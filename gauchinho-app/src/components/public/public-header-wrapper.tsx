"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function PublicHeaderWrapper({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-all duration-500",
        scrolled
          ? "border-zinc-700/60 bg-zinc-950/85 shadow-xl shadow-black/40 backdrop-blur-2xl"
          : "border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/55",
        className,
      )}
    >
      {children}
    </header>
  );
}
