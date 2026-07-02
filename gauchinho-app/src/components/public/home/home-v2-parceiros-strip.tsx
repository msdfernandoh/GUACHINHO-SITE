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
  border: "#1E3A5F",
  goldBorder: "rgba(201,168,76,0.3)",
} as const;

type Props = {
  parceiros: ParceiroInstitucional[];
};

export function HomeV2ParceirosStrip({ parceiros }: Props) {
  if (!parceiros.length) return null;

  return (
    <section className="px-4 py-16 sm:px-6" style={{ background: C.bgCard }}>
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.gold }}>
          Confiança
        </p>
        <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Parceiros</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>
          Administradoras e empresas que reforçam nossa atuação.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-3xl">
        <div
          className="flex gap-4 overflow-x-auto rounded-2xl border px-5 py-6 scrollbar-thin sm:justify-center sm:overflow-x-visible sm:flex-wrap"
          style={{ background: C.bg, borderColor: C.goldBorder }}
        >
          {parceiros.map((p) => (
            <motion.div
              key={p.id}
              whileHover={{ scale: 1.03 }}
              className="flex h-[7.5rem] w-[7.5rem] shrink-0 items-center justify-center rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-md shadow-black/25 sm:h-32 sm:w-32 sm:p-4"
              title={p.nome}
            >
              {p.logo_url ? (
                <div className="relative h-full w-full min-h-[4.5rem] min-w-[4.5rem]">
                  <PartnerLogoImage src={p.logo_url} alt={p.nome} fill sizes="128px" fallbackText={p.nome} />
                </div>
              ) : (
                <span className="text-center text-xs font-bold leading-tight text-zinc-800">{p.nome}</span>
              )}
            </motion.div>
          ))}
        </div>
        <p className="mt-4 text-center">
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
