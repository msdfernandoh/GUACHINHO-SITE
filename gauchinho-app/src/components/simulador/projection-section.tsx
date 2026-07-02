"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import type { LinhaProjecaoAnual } from "@/lib/simulador/projecao";
import { AVISO_PROJECAO } from "./simulador-types";
import { sectionCardClass } from "./simulador-ui";
import { Button } from "@/components/ui/form-primitives";

type Props = {
  resumoAno1: LinhaProjecaoAnual | undefined;
  projecao: LinhaProjecaoAnual[];
  tabelaAberta: boolean;
  onToggleTabela: () => void;
};

export function ProjectionSection({
  resumoAno1,
  projecao,
  tabelaAberta,
  onToggleTabela,
}: Props) {
  if (!resumoAno1) return null;

  return (
    <section className={sectionCardClass()}>
      <h3 className="text-lg font-bold text-amber-400">Vantagem da programação financeira</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-950/60 p-4">
          <p className="text-xs uppercase text-slate-500">Total pago em 1 ano</p>
          <p className="mt-1 text-xl font-bold">{formatCurrency(resumoAno1.totalPagoAcumulado)}</p>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-4">
          <p className="text-xs uppercase text-slate-500">Crédito estimado em 1 ano</p>
          <p className="mt-1 text-xl font-bold">{formatCurrency(resumoAno1.creditoEstimadoReajustado)}</p>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-4">
          <p className="text-xs uppercase text-slate-500">Ganho patrimonial estimado</p>
          <p className="mt-1 text-xl font-bold">{formatCurrency(resumoAno1.ganhoPatrimonialEstimado)}</p>
          <p className="mt-1 text-[10px] text-slate-500">Valorização do crédito (reajuste anual)</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{AVISO_PROJECAO}</p>
      <Button
        type="button"
        variant="outlineGold"
        className="mt-4 w-full border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 sm:w-auto"
        onClick={onToggleTabela}
      >
        {tabelaAberta ? (
          <>
            <ChevronUp className="mr-2 h-4 w-4" /> Ocultar projeção completa
          </>
        ) : (
          <>
            <ChevronDown className="mr-2 h-4 w-4" /> Ver projeção completa
          </>
        )}
      </Button>
      {tabelaAberta && projecao.length ? (
        <div className="mt-4 space-y-2 sm:hidden">
          {projecao.map((l) => (
            <div key={l.ano} className="rounded-lg border border-slate-700/60 p-3 text-sm">
              <p className="font-bold text-amber-400/90">Ano {l.ano}</p>
              <p className="text-slate-400">Parcela do ano: {formatCurrency(l.parcelaEstimadaNoPeriodo)}</p>
              <p className="text-slate-400">Total pago: {formatCurrency(l.totalPagoAcumulado)}</p>
              <p className="text-slate-400">Crédito reaj.: {formatCurrency(l.creditoEstimadoReajustado)}</p>
              <p className="text-slate-400">Ganho patrimonial: {formatCurrency(l.ganhoPatrimonialEstimado)}</p>
            </div>
          ))}
        </div>
      ) : null}
      {tabelaAberta && projecao.length ? (
        <div className="mt-4 hidden max-h-80 overflow-auto rounded-lg border border-slate-800 sm:block">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-slate-900 text-left text-slate-500">
              <tr>
                <th className="p-2">Ano</th>
                <th className="p-2">Meses</th>
                <th className="p-2">Parcela do ano</th>
                <th className="p-2">Total pago</th>
                <th className="p-2">Crédito reaj.</th>
                <th className="p-2">Ganho pat.</th>
                <th className="p-2">Crédito líq.</th>
              </tr>
            </thead>
            <tbody>
              {projecao.map((l) => (
                <tr key={l.ano} className="border-t border-slate-800">
                  <td className="p-2">{l.ano}</td>
                  <td className="p-2">{l.mesesPagosAcumulados}</td>
                  <td className="p-2">{formatCurrency(l.parcelaEstimadaNoPeriodo)}</td>
                  <td className="p-2">{formatCurrency(l.totalPagoAcumulado)}</td>
                  <td className="p-2">{formatCurrency(l.creditoEstimadoReajustado)}</td>
                  <td className="p-2">{formatCurrency(l.ganhoPatrimonialEstimado)}</td>
                  <td className="p-2">{formatCurrency(l.creditoLiquidoEstimado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
