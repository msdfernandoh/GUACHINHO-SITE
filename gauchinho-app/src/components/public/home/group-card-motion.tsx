"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { formatPrazoGrupo } from "@/lib/grupos/simulacao-linha";
import type { HomeGrupoDestaque } from "@/lib/home/load-home-data";
import { labelModalidadeGrupoPublica } from "@/lib/grupos/modalidade-label-publica";

export function GroupCardMotion({
  grupo,
  cota,
  index,
}: HomeGrupoDestaque & { index: number }) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.article
      className="home-gold-glow flex h-full flex-col rounded-3xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-6"
      initial={shouldReduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.65, ease: [0.25, 0.1, 0.25, 1], delay: index * 0.06 }}
      whileHover={shouldReduce ? undefined : { y: -4, borderColor: "rgba(245,158,11,0.35)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-bold text-white">Grupo {grupo.codigo_grupo}</h3>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
          {labelModalidadeGrupoPublica(grupo.modalidade)}
        </span>
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-2 border-b border-zinc-800/80 pb-2">
          <dt className="text-zinc-500">Crédito</dt>
          <dd className="text-lg font-bold text-amber-300">
            {formatCurrency(Number(cota.valor_credito))}
          </dd>
        </div>
        <div className="flex justify-between gap-2 border-b border-zinc-800/80 pb-2">
          <dt className="text-zinc-500">Parcela ref.</dt>
          <dd className="font-semibold text-amber-400">
            {cota.valor_parcela != null ? formatCurrency(Number(cota.valor_parcela)) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Prazo</dt>
          <dd className="text-zinc-300">{formatPrazoGrupo(grupo)}</dd>
        </div>
      </dl>
      <Link
        href="/grupos"
        className="mt-6 inline-flex rounded-full border border-zinc-700 px-4 py-2.5 text-center text-sm font-semibold text-zinc-200 transition hover:border-amber-500/50 hover:text-amber-300"
      >
        Ver grupo
      </Link>
    </motion.article>
  );
}
