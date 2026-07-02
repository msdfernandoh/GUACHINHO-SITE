"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PartnerLogoImage } from "@/components/public/partner-logo-image";
import type { ParceiroInstitucional } from "@/lib/conteudo/types";

const C = {
  bg: "#07111F",
  bgCard: "#0D1E33",
  gold: "#C9A84C",
  muted: "#94A3B8",
  goldBorder: "rgba(201,168,76,0.3)",
} as const;

type Props = {
  parceiros: ParceiroInstitucional[];
  /** Última faixa da Home, colada visualmente ao rodapé. */
  anchorFooter?: boolean;
};

export function HomeV2ParceirosStrip({ parceiros, anchorFooter = false }: Props) {
  if (!parceiros.length) return null;

  return (
    <section
      className={
        anchorFooter
          ? "border-t border-zinc-800/90 px-4 py-12 sm:px-6 sm:py-14"
          : "px-4 py-16 sm:px-6"
      }
      style={{ background: anchorFooter ? "#0a1628" : C.bgCard }}
    >
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.gold }}>
          Confiança
        </p>
        <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Parceiros</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>
          Administradoras e empresas que reforçam nossa atuação.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-5xl">
        <div
          className="flex gap-5 overflow-x-auto rounded-2xl border px-4 py-8 scrollbar-thin sm:flex-wrap sm:justify-center sm:overflow-x-visible sm:px-8 sm:py-10"
          style={{ background: C.bg, borderColor: C.goldBorder }}
        >
          {parceiros.map((p) => (
            <motion.div
              key={p.id}
              whileHover={{ scale: 1.02 }}
              className="flex h-[8.5rem] w-[10.5rem] shrink-0 items-center justify-center rounded-2xl border border-zinc-200/95 bg-white p-4 shadow-lg shadow-black/20 sm:h-[9.5rem] sm:w-[12rem] sm:p-5 md:h-[10rem] md:w-[13rem]"
              title={p.nome}
            >
              {p.logo_url ? (
                <div className="relative h-full w-full min-h-[5.5rem] min-w-[7rem]">
                  <PartnerLogoImage
                    src={p.logo_url}
                    alt={p.nome}
                    fill
                    large
                    sizes="(max-width: 640px) 168px, 208px"
                    fallbackText={p.nome}
                  />
                </div>
              ) : (
                <span className="px-2 text-center text-sm font-bold leading-snug text-zinc-800 sm:text-base">
                  {p.nome}
                </span>
              )}
            </motion.div>
          ))}
        </div>
        <p className="mt-5 text-center">
          <Link
            href="/parceiros"
            className="text-sm font-semibold transition hover:opacity-90"
            style={{ color: C.gold }}
          >
            Ver todos os parceiros →
          </Link>
        </p>
      </div>
    </section>
  );
}
