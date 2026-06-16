"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";

/** Rotas com scroll nativo (planilhas/modais longos); Lenis trunca a altura scrollável. */
function lenisDisabledForPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/grupos" ||
    pathname.startsWith("/simulador") ||
    pathname.startsWith("/calculadoras")
  );
}

export function LenisProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const disabled = lenisDisabledForPath(pathname);

  useEffect(() => {
    if (!disabled) return;
    document.documentElement.classList.remove("lenis", "lenis-smooth", "lenis-stopped");
    document.documentElement.style.removeProperty("height");
    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [disabled]);

  return <>{children}</>;
}
