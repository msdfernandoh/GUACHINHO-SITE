"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { HOME_MEDIA } from "@/lib/home/home-media";
import type { MascotContextKey } from "@/lib/mascot/mascot-phrases";
import { MASCOT_SESSION_PHRASE_PREFIX, pickMascotPhrase } from "@/lib/mascot/mascot-phrases";

/** Mesmo mascote da home (SVG transparente). Fallback: gif animado. */
const MASCOT_SRC = HOME_MEDIA.mascoteSvg;
const MASCOT_FALLBACK_SRC = "/media/gauchinho-mascote.gif";

type Props = {
  context: MascotContextKey;
  /** Frase fixa opcional; por padrão usa a frase contextual. */
  phrase?: string;
  /** Lado do mascote em relação ao balão. */
  align?: "left" | "right";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "h-16 w-16 sm:h-20 sm:w-20",
  md: "h-20 w-20 sm:h-24 sm:w-24",
  lg: "h-24 w-24 sm:h-28 sm:w-28",
} as const;

/**
 * Mascote integrado ao layout (in-flow) com balão contextual.
 * Diferente do antigo mascote flutuante, este acompanha o conteúdo da página.
 */
export function GauchinhoMascotInline({
  context,
  phrase: fixedPhrase,
  align = "left",
  size = "md",
  className,
}: Props) {
  const [phrase, setPhrase] = useState(fixedPhrase ?? "");
  const [src, setSrc] = useState<string>(MASCOT_SRC);

  useEffect(() => {
    if (fixedPhrase) return;
    setPhrase(pickMascotPhrase(context, `${MASCOT_SESSION_PHRASE_PREFIX}:inline:${context}`));
  }, [context, fixedPhrase]);

  if (!phrase) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        align === "right" ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      <div className={cn("pointer-events-none relative shrink-0 animate-gauchinho-mascot-float", SIZES[size])}>
        <Image
          src={src}
          alt=""
          fill
          unoptimized
          sizes="112px"
          className="object-contain object-bottom drop-shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
          onError={() => {
            if (src !== MASCOT_FALLBACK_SRC) setSrc(MASCOT_FALLBACK_SRC);
          }}
        />
      </div>
      <div className="relative max-w-[15rem] rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-left shadow-lg shadow-black/20">
        <p className="text-xs font-semibold leading-snug text-slate-900 sm:text-sm">{phrase}</p>
        <span
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-slate-200/90 bg-white",
            align === "right"
              ? "-right-1.5 border-r border-t"
              : "-left-1.5 border-b border-l",
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}
