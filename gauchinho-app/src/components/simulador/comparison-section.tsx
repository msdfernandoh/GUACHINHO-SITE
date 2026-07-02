import { formatCurrency } from "@/lib/utils/format";
import type {
  ComparativoConsorcioFinanciamento,
  DetalheAlternativaConsorcio,
} from "@/lib/simulador/comparativo";
import type { Modo } from "./simulador-types";
import { sectionCardClass } from "./simulador-ui";

type Props = {
  modo: Modo;
  comparativo: ComparativoConsorcioFinanciamento;
  alternativaConsorcio?: DetalheAlternativaConsorcio | null;
};

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-white">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function ComparisonSection({ modo, comparativo, alternativaConsorcio }: Props) {
  const isConsorcioPrimary = modo === "consorcio";
  const alt = !isConsorcioPrimary ? alternativaConsorcio : null;

  return (
    <section className={sectionCardClass("border-slate-700/40 bg-slate-900/30")}>
      {isConsorcioPrimary ? (
        <>
          <h3 className="text-lg font-bold text-white">Comparação com financiamento</h3>
          <p className="mt-1 text-sm text-slate-400">
            Veja como essa programação pode se comparar a uma compra financiada.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Referência financiamento: {formatCurrency(comparativo.financiamento.valorBem)} ·{" "}
            {comparativo.financiamento.prazoMeses} meses
            {comparativo.financiamento.entrada > 0
              ? ` · entrada ${formatCurrency(comparativo.financiamento.entrada)}`
              : null}
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-bold text-white">Consórcio como alternativa de planejamento</h3>
          <p className="mt-1 text-sm text-slate-400">
            Mesmo crédito ({formatCurrency(alt?.valorCredito ?? comparativo.consorcio.valorCredito)}) e prazo (
            {alt?.prazoMeses ?? comparativo.consorcio.prazoMeses} meses) — estimativa de consórcio.
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
        ) : alt ? (
          <div className="sm:col-span-2 space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Parcela cheia" value={`${formatCurrency(alt.parcelaCheia)}/mês`} />
              <Metric
                label="Parcela reduzida"
                value={`${formatCurrency(alt.parcelaReduzida)}/mês`}
                sub={alt.labelParcelaReduzida}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Crédito desejado" value={formatCurrency(alt.valorCredito)} />
              <Metric label="Prazo" value={`${alt.prazoMeses} meses`} />
              <Metric label="Saldo devedor est." value={formatCurrency(alt.saldoDevedorEstimado)} />
              <Metric
                label="Lance (própria carta)"
                value={formatCurrency(alt.lancePropriaCarta)}
                sub="Sem tirar dinheiro do bolso"
              />
              <Metric label="Crédito líquido est." value={formatCurrency(alt.creditoLiquidoEstimado)} />
            </div>
            <p className="text-xs text-slate-500">
              Financiamento simulado: {formatCurrency(comparativo.financiamento.parcelaEstimada)}/mês · custo final{" "}
              {formatCurrency(comparativo.financiamento.custoFinal)}
            </p>
          </div>
        ) : (
          <div className="sm:col-span-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-amber-300">Consórcio (alternativa)</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {formatCurrency(comparativo.consorcio.parcelaEstimada)}/mês
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
