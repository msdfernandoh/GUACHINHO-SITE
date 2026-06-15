import { PercentInput } from "./percent-input";
import { CurrencyInput } from "./currency-input";
import { sectionCardClass, stepBadgeClass } from "./simulador-ui";

type Props = {
  entrada: number;
  onEntrada: (v: number) => void;
  taxaMensal: number;
  onTaxaMensal: (v: number) => void;
  valorBem: number;
};

export function FinanciamentoDetailsStep({
  entrada,
  onEntrada,
  taxaMensal,
  onTaxaMensal,
  valorBem,
}: Props) {
  return (
    <section className={sectionCardClass()}>
      <div className="mb-4 flex items-start gap-3">
        <span className={stepBadgeClass()}>5</span>
        <div>
          <h2 className="text-lg font-bold text-white">Entrada e condições</h2>
          <p className="text-sm text-slate-400">Ajuste entrada e taxa para refinar a simulação</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyInput
          label="Entrada (recurso próprio)"
          value={entrada}
          max={valorBem}
          onChange={onEntrada}
        />
        <PercentInput
          label="Taxa de juros mensal (%)"
          value={taxaMensal}
          onChange={onTaxaMensal}
          step={0.01}
          help="Taxa informada pelo banco ou parceiro."
        />
      </div>
    </section>
  );
}
