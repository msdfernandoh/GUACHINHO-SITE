"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { HOME_MEDIA } from "@/lib/home/home-media";
import type { MascotContextKey } from "@/lib/mascot/mascot-phrases";
import {
  MASCOT_SESSION_HIDDEN_KEY,
  MASCOT_SESSION_PHRASE_PREFIX,
  pickMascotPhrase,
  resolveMascotContext,
} from "@/lib/mascot/mascot-phrases";

/** Mesmo mascote da home (SVG transparente). Fallback: gif animado. */
export const GAUCHINHO_MASCOT_BODY_SRC = HOME_MEDIA.mascoteSvg;
const GAUCHINHO_MASCOT_FALLBACK_SRC = "/media/gauchinho-mascote.gif";

/**
 * Posição por contexto. Sempre à esquerda (o canto inferior direito é
 * reservado ao FAB de chat/WhatsApp). No mobile fica sempre no rodapé
 * esquerdo; no desktop varia a altura na coluna lateral vazia para não
 * sobrepor o conteúdo.
 */
const LG_POSITION: Record<MascotContextKey, string> = {
  home: "",
  simulador: "lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2",
  simulador_imovel: "lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2",
  simulador_veiculo: "lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2",
  grupos: "lg:top-28 lg:bottom-auto",
  contempladas: "lg:top-28 lg:bottom-auto",
  imoveis: "lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2",
  eventos: "lg:top-28 lg:bottom-auto",
  calculadoras: "lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2",
  seguradoras: "lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2",
  login: "",
  proposta: "lg:top-28 lg:bottom-auto",
  default: "",
};

type Props = {
  contextOverride?: MascotContextKey;
  disabled?: boolean;
  /** Mantido por compatibilidade — o mascote fica sempre à esquerda. */
  avoidBottomRightFab?: boolean;
};

export function GauchinhoMascotBubble({
  disabled = false,
  contextOverride,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [context, setContext] = useState<MascotContextKey>("default");
  const [imgSrc, setImgSrc] = useState<string>(GAUCHINHO_MASCOT_BODY_SRC);

  useEffect(() => {
    if (disabled) return;
    if (sessionStorage.getItem(MASCOT_SESSION_HIDDEN_KEY) === "1") return;

    const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
    const ctx = contextOverride ?? resolveMascotContext(pathname ?? "/", search);
    const phraseKey = `${MASCOT_SESSION_PHRASE_PREFIX}:${ctx}`;
    setContext(ctx);
    setPhrase(pickMascotPhrase(ctx, phraseKey));
    setVisible(true);
  }, [disabled, pathname, searchParams, contextOverride]);

  function dismiss() {
    sessionStorage.setItem(MASCOT_SESSION_HIDDEN_KEY, "1");
    setVisible(false);
  }

  if (!visible || disabled) return null;

  return (
    <div
      className={cn(
        "fixed z-40 flex max-w-[min(100vw-1.5rem,17rem)] flex-col items-start sm:max-w-[19rem]",
        "bottom-24 left-3 sm:bottom-28 sm:left-6",
        LG_POSITION[context],
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
            className="absolute -bottom-2 left-8 h-3 w-3 rotate-45 border-b border-r border-slate-200/90 bg-white"
            aria-hidden
          />
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none relative h-28 w-28 shrink-0 self-start sm:h-32 sm:w-32",
          "animate-gauchinho-mascot-float",
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
