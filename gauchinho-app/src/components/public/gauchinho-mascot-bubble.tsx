"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { MascotContextKey } from "@/lib/mascot/mascot-phrases";
import {
  MASCOT_SESSION_HIDDEN_KEY,
  MASCOT_SESSION_PHRASE_PREFIX,
  pickMascotPhrase,
  resolveMascotContext,
} from "@/lib/mascot/mascot-phrases";

/** Personagem com balão — asset em public/media (copiado do servidor local). */
export const GAUCHINHO_MASCOT_BODY_SRC = "/media/gauchinho-mascote-corpo.jpeg";
const GAUCHINHO_MASCOT_FALLBACK_SRC = "/media/gauchinho-sem-fundo.svg";

type Props = {
  contextOverride?: MascotContextKey;
  disabled?: boolean;
  /** IA / WhatsApp flutuante no canto direito — mascote fica à esquerda. */
  avoidBottomRightFab?: boolean;
};

export function GauchinhoMascotBubble({
  disabled = false,
  avoidBottomRightFab = true,
  contextOverride,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [imgSrc, setImgSrc] = useState(GAUCHINHO_MASCOT_BODY_SRC);

  useEffect(() => {
    if (disabled) return;
    if (sessionStorage.getItem(MASCOT_SESSION_HIDDEN_KEY) === "1") return;

    const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
    const context = contextOverride ?? resolveMascotContext(pathname ?? "/", search);
    const phraseKey = `${MASCOT_SESSION_PHRASE_PREFIX}:${context}`;
    setPhrase(pickMascotPhrase(context, phraseKey));
    setVisible(true);
  }, [disabled, pathname, searchParams, contextOverride]);

  function dismiss() {
    sessionStorage.setItem(MASCOT_SESSION_HIDDEN_KEY, "1");
    setVisible(false);
  }

  if (!visible || disabled) return null;

  const anchorRight = !avoidBottomRightFab;

  return (
    <div
      className={cn(
        "fixed z-40 flex max-w-[min(100vw-1.5rem,17rem)] flex-col items-end sm:max-w-[19rem]",
        anchorRight
          ? "bottom-24 right-3 sm:bottom-28 sm:right-6"
          : "bottom-24 left-3 sm:bottom-28 sm:left-6",
      )}
      role="complementary"
      aria-label="Mensagem do Gauchinho"
    >
      <div className="relative mb-1 w-full">
        <button
          type="button"
          onClick={dismiss}
          className="absolute -right-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:bg-slate-100"
          aria-label="Ocultar mascote"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="relative rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 text-left shadow-lg shadow-black/25 sm:px-3.5 sm:py-3">
          <p className="text-xs font-semibold leading-snug text-slate-900 sm:text-sm">{phrase}</p>
          <span
            className={cn(
              "absolute -bottom-2 h-3 w-3 rotate-45 border-b border-r border-slate-200/90 bg-white",
              anchorRight ? "right-8" : "left-8",
            )}
            aria-hidden
          />
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none relative h-28 w-28 shrink-0 sm:h-32 sm:w-32",
          "animate-gauchinho-mascot-float",
          anchorRight ? "self-end" : "self-start",
        )}
      >
        <Image
          src={imgSrc}
          alt=""
          fill
          className="object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          sizes="128px"
          unoptimized
          onError={() => {
            if (imgSrc !== GAUCHINHO_MASCOT_FALLBACK_SRC) setImgSrc(GAUCHINHO_MASCOT_FALLBACK_SRC);
          }}
        />
      </div>
    </div>
  );
}
