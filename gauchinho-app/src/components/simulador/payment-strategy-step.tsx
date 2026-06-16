import { formatCurrency } from "@/lib/utils/format";
import type { OpcaoParcelaConsorcio } from "@/lib/config/simulador-parcela-opcoes";
import { calcularParcelaReduzida } from "@/lib/simulador/consorcio";
import { choiceCardClass, sectionCardClass, stepBadgeClass } from "./simulador-ui";

type Props = {
  opcoes: OpcaoParcelaConsorcio[];
  selectedId: string;
  onSelect: (id: string) => void;
  parcelaIntegral: number;
};

export function PaymentStrategyStep({
  opcoes,
  selectedId,
  onSelect,
  parcelaIntegral,
}: Props) {
  const selected = opcoes.find((o) => o.id === selectedId) ?? opcoes[0];
  const multipla = opcoes.length > 1;

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
          </p>
        </div>
      </div>
      {multipla ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {opcoes.map((op) => {
            const parcela = calcularParcelaReduzida(parcelaIntegral, op.percentual);
            const sel = op.id === selectedId;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => onSelect(op.id)}
                className={choiceCardClass(sel, "p-5 text-left")}
              >
                <p className="text-lg font-bold">{op.nome}</p>
                {op.descricao ? <p className="mt-1 text-sm opacity-90">{op.descricao}</p> : null}
                <p className="mt-3 text-2xl font-extrabold">{formatCurrency(parcela)}</p>
                <p className="mt-1 text-xs opacity-75">{op.percentual}% da parcela integral</p>
              </button>
            );
          })}
        </div>
      ) : selected ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <p className="text-lg font-bold text-amber-300">{selected.nome}</p>
          {selected.descricao ? (
            <p className="mt-1 text-sm text-slate-300">{selected.descricao}</p>
          ) : null}
          <p className="mt-3 text-3xl font-extrabold text-white">
            {formatCurrency(calcularParcelaReduzida(parcelaIntegral, selected.percentual))}
          </p>
          <p className="mt-1 text-xs text-slate-400">{selected.percentual}% da parcela integral</p>
        </div>
      ) : null}
    </section>
  );
}
