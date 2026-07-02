"use client";

import { useEffect, type ReactNode } from "react";
import { clearLenisScrollArtifacts } from "@/lib/ui/use-lock-body-scroll";

/**
 * Scroll nativo no site público (Lenis desativado — truncava páginas longas e “agarrava” a barra).
 * Mantém cleanup de classes/styles que o Lenis antigo pudesse deixar.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    clearLenisScrollArtifacts();
  }, []);

  return <>{children}</>;
}
