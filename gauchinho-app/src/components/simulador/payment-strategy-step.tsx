import { formatCurrency } from "@/lib/utils/format";
import type { EstrategiaPagamento } from "./simulador-types";
import { choiceCardClass, sectionCardClass, stepBadgeClass } from "./simulador-ui";

type Props = {
  estrategia: EstrategiaPagamento;
  onChange: (e: EstrategiaPagamento) => void;
  mostrarReduzida: boolean;
  percentualReduzida: number;
  parcelaIntegral: number;
  parcelaReduzida: number;
};

export function PaymentStrategyStep({
  estrategia,
  onChange,
  mostrarReduzida,
  percentualReduzida,
  parcelaIntegral,
  parcelaReduzida,
}: Props) {
  return (
    <section className={sectionCardClass()}>
      <div className="mb-4 flex items-start gap-3">
        <span className={stepBadgeClass()}>5</span>
        <div>
          <h2 className="text-lg font-bold text-white">Estratégia de pagamento</h2>
          <p className="text-sm text-slate-400">Como você prefere pagar as parcelas iniciais?</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {mostrarReduzida ? (
          <button
            type="button"
            onClick={() => onChange("reduzida")}
            className={choiceCardClass(estrategia === "reduzida", "p-5 text-left")}
          >
            <p className="text-lg font-bold">Parcela reduzida</p>
            <p className="mt-1 text-sm opacity-90">
              Parcela inicial menor para facilitar a entrada no plano.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide opacity-80">
              {percentualReduzida}% da parcela integral
            </p>
            <p className="mt-1 text-2xl font-extrabold">{formatCurrency(parcelaReduzida)}</p>
            <p className="mt-2 text-xs opacity-75">
              Após contemplação, a parcela pode ser complementada conforme regras do grupo.
            </p>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onChange("integral")}
          className={choiceCardClass(estrategia === "integral", "p-5 text-left")}
        >
          <p className="text-lg font-bold">Parcela integral</p>
          <p className="mt-1 text-sm opacity-90">Pagamento completo desde o início.</p>
          <p className="mt-4 text-2xl font-extrabold">{formatCurrency(parcelaIntegral)}</p>
        </button>
      </div>
    </section>
  );
}
