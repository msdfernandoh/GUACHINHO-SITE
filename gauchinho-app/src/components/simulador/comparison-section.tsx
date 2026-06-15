import { formatCurrency } from "@/lib/utils/format";
import type { ComparativoConsorcioFinanciamento } from "@/lib/simulador/comparativo";
import type { Modo } from "./simulador-types";
import { sectionCardClass } from "./simulador-ui";

type Props = {
  modo: Modo;
  comparativo: ComparativoConsorcioFinanciamento;
};

export function ComparisonSection({ modo, comparativo }: Props) {
  const isConsorcioPrimary = modo === "consorcio";

  return (
    <section className={sectionCardClass("border-slate-700/40 bg-slate-900/30")}>
      {isConsorcioPrimary ? (
        <>
          <h3 className="text-lg font-bold text-white">Comparação com financiamento</h3>
          <p className="mt-1 text-sm text-slate-400">
            Veja como essa programação pode se comparar a uma compra financiada.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-bold text-white">Consórcio como alternativa de planejamento</h3>
          <p className="mt-1 text-sm text-slate-400">
            Se a compra não precisa ser imediata, o consórcio pode ser uma alternativa para reduzir o
            custo total estimado.
          </p>
        </>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {isConsorcioPrimary ? (
          <>
            <div className="order-1 rounded-xl border border-amber-500/50 bg-amber-500/15 p-4 ring-1 ring-amber-400/30">
              <p className="text-sm font-bold uppercase tracking-wide text-amber-300">Consórcio (sua escolha)</p>
              <p className="mt-2 text-xl font-bold text-white">
                {formatCurrency(comparativo.consorcio.parcelaEstimada)}/mês
              </p>
              <p className="text-sm text-slate-400">
                Total est.: {formatCurrency(comparativo.consorcio.valorTotalEstimado)}
              </p>
            </div>
            <div className="order-2 rounded-xl border border-sky-800/40 bg-sky-950/30 p-4">
              <p className="text-sm font-bold uppercase tracking-wide text-sky-300">Financiamento (referência)</p>
              <p className="mt-2 text-xl font-bold text-white">
                {formatCurrency(comparativo.financiamento.parcelaEstimada)}/mês
              </p>
              <p className="text-sm text-slate-400">
                Custo final: {formatCurrency(comparativo.financiamento.custoFinal)}
              </p>
            </div>
          </>
        ) : (
          <div className="sm:col-span-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-amber-300">Consórcio (alternativa)</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {formatCurrency(comparativo.consorcio.parcelaEstimada)}/mês
            </p>
            <p className="text-sm text-slate-400">
              Total estimado: {formatCurrency(comparativo.consorcio.valorTotalEstimado)}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Financiamento simulado: {formatCurrency(comparativo.financiamento.parcelaEstimada)}/mês · custo final{" "}
              {formatCurrency(comparativo.financiamento.custoFinal)}
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 rounded-lg bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
        Diferença estimada de custo total:{" "}
        <strong className="text-amber-400">{formatCurrency(comparativo.diferencaCustoTotal)}</strong>
        {" · "}
        Diferença de parcela:{" "}
        <strong className="text-amber-400">{formatCurrency(comparativo.diferencaParcela)}</strong>
      </p>
    </section>
  );
}
