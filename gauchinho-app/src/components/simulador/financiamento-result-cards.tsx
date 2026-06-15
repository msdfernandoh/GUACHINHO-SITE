import { formatCurrency } from "@/lib/utils/format";
import type { ResultadoFinanciamento } from "@/lib/simulador/financiamento";
import { sectionCardClass } from "./simulador-ui";

type Props = {
  resultado: ResultadoFinanciamento;
  valorBem: number;
  entrada: number;
  taxaMensal: number;
};

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={
          highlight ? "mt-1 text-2xl font-extrabold text-white" : "mt-1 text-lg font-bold text-slate-100"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function FinanciamentoResultCards({ resultado, valorBem, entrada, taxaMensal }: Props) {
  return (
    <section className={sectionCardClass("border-slate-600/50")}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Sua simulação — financiamento</p>
      <h2 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
        {formatCurrency(resultado.parcelaEstimada)}
        <span className="text-lg font-semibold text-slate-400"> /mês</span>
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Valor do bem" value={formatCurrency(valorBem)} />
        <Metric label="Entrada" value={formatCurrency(entrada)} />
        <Metric label="Valor financiado" value={formatCurrency(resultado.valorFinanciado)} />
        <Metric label="Taxa mensal" value={`${taxaMensal.toLocaleString("pt-BR")}%`} />
        <Metric label="Parcela estimada" value={formatCurrency(resultado.parcelaEstimada)} highlight />
        <Metric label="Total pago" value={formatCurrency(resultado.valorTotalPago)} />
        <Metric label="Juros estimados" value={formatCurrency(resultado.jurosTotais)} />
        <Metric label="Custo final" value={formatCurrency(resultado.custoFinal)} />
      </div>
    </section>
  );
}
