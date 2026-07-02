"use client";

import { MascoteGauchinho } from "@/components/public/mascote-gauchinho";
import { cn } from "@/lib/utils/cn";

/** Mascote fixo (ICONE.svg) em todas as páginas públicas — não captura scroll/clique. */
export function PublicFloatingMascot() {
  return (
    <div
      className={cn(
        "pointer-events-none fixed z-30 opacity-90",
        "bottom-[5.5rem] left-3 sm:bottom-24 sm:left-auto sm:right-4",
      )}
      aria-hidden
    >
      <MascoteGauchinho variant="floating" className="h-12 w-12 sm:h-14 sm:w-14" />
    </div>
  );
}
