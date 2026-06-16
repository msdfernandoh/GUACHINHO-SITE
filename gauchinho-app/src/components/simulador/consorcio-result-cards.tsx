import { formatCurrency } from "@/lib/utils/format";
import {
  formatarPercentualSimulador,
  type ResultadoContemplacaoMes1,
} from "@/lib/simulador/consorcio";
import { sectionCardClass } from "./simulador-ui";

const AVISO_CONTEMPLACAO =
  "Esta simulação considera contemplação no primeiro mês para demonstrar o impacto do lance no saldo devedor e na parcela pós-contemplação. Valores reais podem variar conforme administradora, grupo, regras contratuais, assembleia e data de contemplação.";

type Props = {
  contemplacao: ResultadoContemplacaoMes1;
  estrategiaLabel: string;
};

function Metric({
  label,
  value,
  highlight,
  sub,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  sub?: string;
}) {
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
      {sub ? <p className="mt-1 text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function ConsorcioResultCards({ contemplacao, estrategiaLabel }: Props) {
  const c = contemplacao;
  return (
    <section className={sectionCardClass("border-amber-500/30 bg-gradient-to-br from-slate-900/90 to-slate-950")}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Sua simulação — consórcio</p>
      <h2 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
        {formatCurrency(c.primeiraParcela)}
        <span className="text-lg font-semibold text-slate-400"> /mês inicial</span>
      </h2>
      <p className="mt-1 text-sm text-slate-400">{estrategiaLabel}</p>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{AVISO_CONTEMPLACAO}</p>
      {c.avisoSaldo ? <p className="mt-2 text-xs text-amber-200">{c.avisoSaldo}</p> : null}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Crédito desejado" value={formatCurrency(c.valorCredito)} />
        <Metric label="Prazo" value={`${c.prazoMeses} meses`} />
        <Metric label="Parcela inicial estimada" value={formatCurrency(c.primeiraParcela)} highlight />
        <Metric label="Lance próprio" value={formatCurrency(c.entrada)} />
        <Metric label="Lance embutido" value={formatCurrency(c.lanceEmbutido)} />
        <Metric label="Lance total" value={formatCurrency(c.lanceTotal)} />
        <Metric label="Saldo devedor inicial" value={formatCurrency(c.saldoDevedorInicial)} />
        <Metric label="Saldo devedor final" value={formatCurrency(c.saldoDevedorFinal)} />
        <Metric
          label="Parcela pós-contemplação"
          value={formatCurrency(c.parcelaPosContemplacao)}
          highlight
          sub="Após contemplação no 1º mês, com lance e saldo restante"
        />
        <Metric label="Parcelas restantes" value={String(c.parcelasRestantes)} />
        <Metric
          label="Custo adm. efetivo mensal"
          value={`${formatarPercentualSimulador(c.custoAdmEfetivoMensalPercentual)} a.m.`}
        />
        <Metric
          label="Custo adm. efetivo anual"
          value={`${formatarPercentualSimulador(c.custoAdmEfetivoAnualPercentual)} a.a.`}
        />
      </div>
    </section>
  );
}
