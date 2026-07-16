import { formatCurrency } from "@/lib/utils/format";
import type { OpcaoParcelaConsorcio } from "@/lib/config/simulador-parcela-opcoes";
import { calcularParcelaReduzida } from "@/lib/simulador/consorcio";
import { choiceCardClass, sectionCardClass, stepBadgeClass } from "./simulador-ui";

type Props = {
  opcoes: OpcaoParcelaConsorcio[];
  selectedId: string;
  onSelect: (id: string) => void;
  parcelaAmortizacao: number;
  seguroMensal: number;
  /** Quando informado, substitui o % das opções reduzidas (&lt; 100). */
  percentualReduzidaOverride?: number | null;
};

function parcelaOpcao(parcelaAmortizacao: number, seguroMensal: number, percentual: number) {
  return calcularParcelaReduzida(parcelaAmortizacao, percentual) + seguroMensal;
}

function percentualExibido(
  op: OpcaoParcelaConsorcio,
  override: number | null | undefined,
): number {
  if (
    override != null &&
    Number.isFinite(override) &&
    override > 0 &&
    override < 100 &&
    op.percentual < 100
  ) {
    return override;
  }
  return op.percentual;
}

export function PaymentStrategyStep({
  opcoes,
  selectedId,
  onSelect,
  parcelaAmortizacao,
  seguroMensal,
  percentualReduzidaOverride = null,
}: Props) {
  const selected = opcoes.find((o) => o.id === selectedId) ?? opcoes[0];
  const multipla = opcoes.length > 1;
  const overrideAtivo =
    percentualReduzidaOverride != null &&
    percentualReduzidaOverride > 0 &&
    percentualReduzidaOverride < 100;

  return (
    <section className={sectionCardClass()}>
      <div className="mb-4 flex items-start gap-3">
        <span className={stepBadgeClass()}>5</span>
        <div>
          <h2 className="text-lg font-bold text-white">Opção de parcela inicial</h2>
          <p className="text-sm text-slate-400">
            {multipla
              ? "Escolha como deseja pagar no início do plano."
              : "Opção de parcela aplicada nesta simulação."}
            {overrideAtivo ? (
              <span className="mt-1 block text-amber-300/90">
                Parcela reduzida personalizada ativa: {percentualReduzidaOverride}% da integral.
              </span>
            ) : null}
          </p>
        </div>
      </div>
      {multipla ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {opcoes.map((op) => {
            const pct = percentualExibido(op, percentualReduzidaOverride);
            const parcela = parcelaOpcao(parcelaAmortizacao, seguroMensal, pct);
            const sel = op.id === selectedId;
            const nome =
              overrideAtivo && op.percentual < 100 ? `${pct}% da parcela` : op.nome;
            const descricao =
              overrideAtivo && op.percentual < 100
                ? "Parcela reduzida personalizada (ajustada na estratégia)."
                : op.descricao;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => onSelect(op.id)}
                className={choiceCardClass(sel, "p-5 text-left")}
              >
                <p className="text-lg font-bold">{nome}</p>
                {descricao ? <p className="mt-1 text-sm opacity-90">{descricao}</p> : null}
                <p className="mt-3 text-2xl font-extrabold">{formatCurrency(parcela)}</p>
                <p className="mt-1 text-xs opacity-75">{pct}% da parcela integral</p>
              </button>
            );
          })}
        </div>
      ) : selected ? (
        (() => {
          const pct = percentualExibido(selected, percentualReduzidaOverride);
          return (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
              <p className="text-lg font-bold text-amber-300">
                {overrideAtivo && selected.percentual < 100
                  ? `${pct}% da parcela`
                  : selected.nome}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {overrideAtivo && selected.percentual < 100
                  ? "Parcela reduzida personalizada (ajustada na estratégia)."
                  : selected.descricao}
              </p>
              <p className="mt-3 text-3xl font-extrabold text-white">
                {formatCurrency(parcelaOpcao(parcelaAmortizacao, seguroMensal, pct))}
              </p>
              <p className="mt-1 text-xs text-slate-400">{pct}% da parcela integral</p>
            </div>
          );
        })()
      ) : null}
    </section>
  );
}
