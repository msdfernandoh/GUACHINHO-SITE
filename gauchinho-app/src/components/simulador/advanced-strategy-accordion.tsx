"use client";

import { formatCurrency } from "@/lib/utils/format";
import { CurrencyInput } from "./currency-input";
import { PercentInput } from "./percent-input";
import { fieldHelpClass, sectionCardClass } from "./simulador-ui";
import { cn } from "@/lib/utils/cn";

type Props = {
  open: boolean;
  onToggle: () => void;
  lanceProprio: number;
  onLanceProprio: (v: number) => void;
  lanceEmbutido: number;
  onLanceEmbutido: (v: number) => void;
  lanceTotal: number;
  taxaAdm: number;
  onTaxaAdm: (v: number) => void;
  fundoReserva: number;
  onFundoReserva: (v: number) => void;
  seguro: number;
  onSeguro: (v: number) => void;
  reajusteCredito: number;
  onReajusteCredito: (v: number) => void;
  correcaoParcela: number;
  onCorrecaoParcela: (v: number) => void;
  maxLanceEmbutido?: number;
};

export function AdvancedStrategyAccordion({
  open,
  onToggle,
  lanceProprio,
  onLanceProprio,
  lanceEmbutido,
  onLanceEmbutido,
  lanceTotal,
  taxaAdm,
  onTaxaAdm,
  fundoReserva,
  onFundoReserva,
  seguro,
  onSeguro,
  reajusteCredito,
  onReajusteCredito,
  correcaoParcela,
  onCorrecaoParcela,
  maxLanceEmbutido,
}: Props) {
  return (
    <section className={sectionCardClass("overflow-hidden")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-base font-semibold text-amber-400">
          {open ? "− Ajustar estratégia de lance e índices" : "+ Ajustar estratégia de lance e índices"}
        </span>
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "mt-5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-6 border-t border-slate-700/60 pt-5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Lance</h3>
              <p className={fieldHelpClass()}>
                Lance próprio é o valor que você pretende usar com recursos próprios. Lance embutido é
                uma parte do crédito utilizada na estratégia de contemplação, quando permitido.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <CurrencyInput
                  label="Lance próprio / recurso próprio"
                  value={lanceProprio}
                  onChange={onLanceProprio}
                  help="Recursos que você aporta do seu bolso."
                />
                <CurrencyInput
                  label="Valor do lance embutido"
                  value={lanceEmbutido}
                  max={maxLanceEmbutido}
                  onChange={onLanceEmbutido}
                  help="Parte do crédito usada como lance, conforme regras."
                />
              </div>
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-amber-200/90">Lance total</p>
                <p className="text-xl font-bold text-amber-400">{formatCurrency(lanceTotal)}</p>
                <p className="text-xs text-slate-400">Lance próprio + lance embutido (calculado automaticamente)</p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">
                Taxas e índices
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <PercentInput
                  label="Taxa administrativa (%)"
                  value={taxaAdm}
                  onChange={onTaxaAdm}
                  step={0.01}
                  help="Percentual sobre o crédito contratado."
                />
                <PercentInput
                  label="Fundo de reserva (%)"
                  value={fundoReserva}
                  onChange={onFundoReserva}
                  step={0.01}
                />
                <PercentInput
                  label="Seguro prestamista (%)"
                  value={seguro}
                  onChange={onSeguro}
                  step={0.001}
                  help="Percentual anual sobre o crédito."
                />
                <PercentInput
                  label="Reajuste anual do crédito (%)"
                  value={reajusteCredito}
                  onChange={onReajusteCredito}
                  step={0.01}
                />
                <PercentInput
                  label="Correção anual da parcela (%)"
                  value={correcaoParcela}
                  onChange={onCorrecaoParcela}
                  step={0.01}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
