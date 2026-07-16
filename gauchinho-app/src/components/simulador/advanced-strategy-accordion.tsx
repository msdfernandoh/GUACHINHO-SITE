"use client";

import { formatCurrency } from "@/lib/utils/format";
import type { ModoLanceInput } from "@/lib/simulador/consorcio";
import { CurrencyInput } from "./currency-input";
import { PercentInput } from "./percent-input";
import { fieldHelpClass, sectionCardClass } from "./simulador-ui";
import { cn } from "@/lib/utils/cn";

function ModoToggle({
  modo,
  onModo,
}: {
  modo: ModoLanceInput;
  onModo: (m: ModoLanceInput) => void;
}) {
  return (
    <div className="mb-2 flex gap-2">
      <button
        type="button"
        onClick={() => onModo("percent")}
        className={cn(
          "rounded-lg px-3 py-1.5 text-xs font-semibold",
          modo === "percent" ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300",
        )}
      >
        %
      </button>
      <button
        type="button"
        onClick={() => onModo("valor")}
        className={cn(
          "rounded-lg px-3 py-1.5 text-xs font-semibold",
          modo === "valor" ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300",
        )}
      >
        R$
      </button>
    </div>
  );
}

type Props = {
  open: boolean;
  onToggle: () => void;
  valorCredito: number;
  lanceProprioModo: ModoLanceInput;
  onLanceProprioModo: (m: ModoLanceInput) => void;
  lanceProprioInput: number;
  onLanceProprioInput: (v: number) => void;
  lanceProprioValor: number;
  lanceEmbutidoModo: ModoLanceInput;
  onLanceEmbutidoModo: (m: ModoLanceInput) => void;
  lanceEmbutidoInput: number;
  onLanceEmbutidoInput: (v: number) => void;
  lanceEmbutidoValor: number;
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
  avisoLance?: string | null;
  aplicarParcelaReduzidaPersonalizada: boolean;
  onAplicarParcelaReduzidaPersonalizada: (v: boolean) => void;
  percentualParcelaPersonalizada: number;
  onPercentualParcelaPersonalizada: (v: number) => void;
};

export function AdvancedStrategyAccordion({
  open,
  onToggle,
  valorCredito,
  lanceProprioModo,
  onLanceProprioModo,
  lanceProprioInput,
  onLanceProprioInput,
  lanceProprioValor,
  lanceEmbutidoModo,
  onLanceEmbutidoModo,
  lanceEmbutidoInput,
  onLanceEmbutidoInput,
  lanceEmbutidoValor,
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
  avisoLance,
  aplicarParcelaReduzidaPersonalizada,
  onAplicarParcelaReduzidaPersonalizada,
  percentualParcelaPersonalizada,
  onPercentualParcelaPersonalizada,
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
                Lance próprio é o recurso que você aporta. Lance embutido utiliza parte do crédito na
                estratégia de contemplação, quando permitido. Simulação considera contemplação no 1º mês.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-200">Lance próprio / recurso próprio</p>
                  <ModoToggle modo={lanceProprioModo} onModo={onLanceProprioModo} />
                  {lanceProprioModo === "percent" ? (
                    <PercentInput
                      label="Percentual sobre o crédito (%)"
                      value={lanceProprioInput}
                      onChange={onLanceProprioInput}
                      max={100}
                    />
                  ) : (
                    <CurrencyInput
                      label="Valor do lance próprio"
                      value={lanceProprioInput}
                      onChange={onLanceProprioInput}
                      max={valorCredito}
                    />
                  )}
                  <p className="mt-1 text-xs text-amber-400/90">
                    Valor aplicado: {formatCurrency(lanceProprioValor)}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-200">Lance embutido</p>
                  <ModoToggle modo={lanceEmbutidoModo} onModo={onLanceEmbutidoModo} />
                  {lanceEmbutidoModo === "percent" ? (
                    <PercentInput
                      label="Percentual sobre o crédito (%)"
                      value={lanceEmbutidoInput}
                      onChange={onLanceEmbutidoInput}
                      max={100}
                    />
                  ) : (
                    <CurrencyInput
                      label="Valor do lance embutido"
                      value={lanceEmbutidoInput}
                      onChange={onLanceEmbutidoInput}
                      max={valorCredito}
                    />
                  )}
                  <p className="mt-1 text-xs text-amber-400/90">
                    Valor aplicado: {formatCurrency(lanceEmbutidoValor)}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-amber-200/90">Lance total</p>
                <p className="text-xl font-bold text-amber-400">{formatCurrency(lanceTotal)}</p>
              </div>
              {avisoLance ? <p className="mt-2 text-xs text-red-300">{avisoLance}</p> : null}
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">
                Parcela reduzida personalizada
              </h3>
              <p className={fieldHelpClass()}>
                Substitui o percentual da opção reduzida (ex.: 60%) pelo valor informado. Vale na
                simulação e no Contratar agora.
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-amber-500"
                  checked={aplicarParcelaReduzidaPersonalizada}
                  onChange={(e) => onAplicarParcelaReduzidaPersonalizada(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-semibold text-amber-200">
                    Aplicar parcela reduzida personalizada
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    Altera o quadro da parcela reduzida na opção de parcela inicial.
                  </span>
                </span>
              </label>
              {aplicarParcelaReduzidaPersonalizada ? (
                <div className="mt-3 max-w-xs">
                  <PercentInput
                    label="Percentual da parcela reduzida (%)"
                    value={percentualParcelaPersonalizada}
                    onChange={onPercentualParcelaPersonalizada}
                    min={1}
                    max={99}
                    step={1}
                  />
                  <p className="mt-1 text-xs text-amber-400/90">
                    Ex.: 40 = parcela inicial de 40% da parcela integral.
                  </p>
                </div>
              ) : null}
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Taxas e índices</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <PercentInput
                  label="Taxa administrativa (%)"
                  value={taxaAdm}
                  onChange={onTaxaAdm}
                  step={0.01}
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
