"use client";

import Link from "next/link";
import { sectionCardClass } from "@/components/simulador/simulador-ui";

type Props = {
  aporte: number;
  prazoMeses: number;
};

export function SimuladorCalculadoraAplicacaoCta({ aporte, prazoMeses }: Props) {
  if (aporte <= 0 || prazoMeses <= 0) return null;

  const params = new URLSearchParams({
    calc: "aplicacao_mensal",
    aporte: String(Math.round(aporte * 100) / 100),
    prazo: String(Math.round(prazoMeses)),
  });
  const href = `/calculadoras?${params.toString()}`;

  return (
    <section className={sectionCardClass("border-emerald-500/20 bg-emerald-950/20")}>
      <p className="text-sm font-semibold text-white">Compare com aplicação financeira</p>
      <p className="mt-2 text-sm text-slate-400">
        Veja quanto renderia investir um valor parecido com sua parcela ao longo do tempo — e compare com
        crédito programado no consórcio.
      </p>
      <Link
        href={href}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-500/40 bg-transparent px-4 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/10"
      >
        Comparar com aplicação
      </Link>
    </section>
  );
}

export function buildCalculadoraAplicacaoHref(aporte: number, prazoMeses: number): string | null {
  if (aporte <= 0 || prazoMeses <= 0) return null;
  const params = new URLSearchParams({
    calc: "aplicacao_mensal",
    aporte: String(Math.round(aporte * 100) / 100),
    prazo: String(Math.round(prazoMeses)),
  });
  return `/calculadoras?${params.toString()}`;
}
