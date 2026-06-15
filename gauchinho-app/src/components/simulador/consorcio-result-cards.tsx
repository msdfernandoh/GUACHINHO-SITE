import { formatCurrency } from "@/lib/utils/format";
import type { ResultadoConsorcio } from "@/lib/simulador/consorcio";
import { sectionCardClass } from "./simulador-ui";

type Props = {
  resultado: ResultadoConsorcio;
  parcelaExibida: number;
  lanceTotal: number;
  creditoLiquido: number;
  estrategiaLabel: string;
};

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={
          highlight ? "mt-1 text-2xl font-extrabold text-amber-400" : "mt-1 text-lg font-bold text-white"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function ConsorcioResultCards({
  resultado,
  parcelaExibida,
  lanceTotal,
  creditoLiquido,
  estrategiaLabel,
}: Props) {
  return (
    <section className={sectionCardClass("border-amber-500/30 bg-gradient-to-br from-slate-900/90 to-slate-950")}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Sua simulação — consórcio</p>
      <h2 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
        {formatCurrency(parcelaExibida)}
        <span className="text-lg font-semibold text-slate-400"> /mês</span>
      </h2>
      <p className="mt-1 text-sm text-slate-400">{estrategiaLabel}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Crédito desejado" value={formatCurrency(resultado.valorCredito)} />
        <Metric label="Prazo" value={`${resultado.prazoMeses} meses`} />
        <Metric label="Parcela estimada" value={formatCurrency(parcelaExibida)} highlight />
        <Metric label="Lance próprio" value={formatCurrency(resultado.entrada)} />
        <Metric label="Lance embutido" value={formatCurrency(resultado.lanceEmbutido)} />
        <Metric label="Lance total" value={formatCurrency(lanceTotal)} />
        <Metric label="Valor total estimado" value={formatCurrency(resultado.valorTotalEstimado)} />
        <Metric label="Crédito líquido est." value={formatCurrency(creditoLiquido)} />
        <Metric label="Taxa adm. total" value={formatCurrency(resultado.taxaAdministrativaTotal)} />
      </div>
    </section>
  );
}
