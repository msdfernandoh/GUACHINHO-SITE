"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ConteudoLogoImage } from "@/components/conteudo/conteudo-logo-image";
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

      <div className="mx-auto mt-8 max-w-2xl">
        <div
          className="flex gap-3 overflow-x-auto rounded-2xl border px-4 py-5 scrollbar-thin sm:justify-center sm:overflow-x-visible sm:flex-wrap"
          style={{ background: C.bg, borderColor: C.goldBorder }}
        >
          {parceiros.map((p) => (
            <motion.div
              key={p.id}
              whileHover={{ scale: 1.03 }}
              className="flex h-16 min-w-[120px] shrink-0 items-center justify-center rounded-xl border px-4 sm:min-w-[130px]"
              style={{ borderColor: C.border, background: "rgba(13,30,51,0.8)" }}
              title={p.nome}
            >
              {p.logo_url ? (
                <div className="relative h-9 w-[100px]">
                  <ConteudoLogoImage src={p.logo_url} alt={p.nome} fill sizes="100px" />
                </div>
              ) : (
                <span className="text-center text-xs font-bold leading-tight text-white">{p.nome}</span>
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
