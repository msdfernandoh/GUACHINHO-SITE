"use client";

import { useState } from "react";
import { Button, Input, Label, surfaceInputDarkSlate } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import { calcularValorFuturo } from "@/lib/calculadoras/valor-futuro";
import { calcularTaxaOperacaoPrice } from "@/lib/calculadoras/taxa-operacao-price";
import { formatCurrency } from "@/lib/utils/format";
import { CalculatorResultCard } from "./calculator-result-card";
import { sectionCardClass } from "@/components/simulador/simulador-ui";

type Props = {
  taxaPadrao: number;
  onResult: (inputs: Record<string, unknown>, resultado: Record<string, unknown>) => void;
};

type Modo = "investimento" | "taxa_operacao";

function num(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatPercent(value: number, decimals = 4) {
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

export function ValorFuturoCalculator({ taxaPadrao, onResult }: Props) {
  const [modo, setModo] = useState<Modo>("investimento");

  const [valorInicial, setValorInicial] = useState("10000");
  const [taxa, setTaxa] = useState(String(taxaPadrao));
  const [prazo, setPrazo] = useState("12");
  const [resultInv, setResultInv] = useState<ReturnType<typeof calcularValorFuturo> | null>(null);

  const [valorCredito, setValorCredito] = useState("100000");
  const [parcela, setParcela] = useState("742");
  const [prazoOp, setPrazoOp] = useState("430");
  const [resultTaxa, setResultTaxa] = useState<ReturnType<typeof calcularTaxaOperacaoPrice> | null>(null);
  const [erroTaxa, setErroTaxa] = useState<string | null>(null);

  function calcularInvestimento() {
    setErroTaxa(null);
    setResultTaxa(null);
    const inputs = {
      modo: "investimento",
      valorInicial: num(valorInicial),
      taxaMensalPercentual: num(taxa),
      prazoMeses: Math.floor(num(prazo)),
    };
    const r = calcularValorFuturo(inputs);
    setResultInv(r);
    onResult(inputs, r);
  }

  function calcularTaxa() {
    setResultInv(null);
    const inputs = {
      modo: "taxa_operacao",
      valorCredito: num(valorCredito),
      parcela: num(parcela),
      prazoMeses: Math.floor(num(prazoOp)),
    };
    const r = calcularTaxaOperacaoPrice(inputs);
    if ("erro" in r) {
      setErroTaxa(r.erro);
      setResultTaxa(null);
      onResult(inputs, { erro: r.erro });
      return;
    }
    setErroTaxa(null);
    setResultTaxa(r);
    onResult(inputs, r);
  }

  function calcular() {
    if (modo === "investimento") calcularInvestimento();
    else calcularTaxa();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setModo("investimento");
            setErroTaxa(null);
          }}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            modo === "investimento"
              ? "bg-amber-500 text-slate-950"
              : "border border-slate-600 text-slate-300 hover:border-amber-500/40",
          )}
        >
          Projetar rendimento
        </button>
        <button
          type="button"
          onClick={() => {
            setModo("taxa_operacao");
            setResultInv(null);
          }}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            modo === "taxa_operacao"
              ? "bg-amber-500 text-slate-950"
              : "border border-slate-600 text-slate-300 hover:border-amber-500/40",
          )}
        >
          Descobrir taxa da proposta
        </button>
      </div>

      <div className={sectionCardClass()}>
        {modo === "investimento" ? (
          <>
            <p className="text-sm font-semibold text-white">Quanto um valor pode render ao longo do tempo?</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-slate-300">Valor inicial (R$)</Label>
                <Input
                  value={valorInicial}
                  onChange={(e) => setValorInicial(e.target.value)}
                  className={cn("mt-1", surfaceInputDarkSlate)}
                />
              </div>
              <div>
                <Label className="text-slate-300">Rentabilidade mensal (%)</Label>
                <Input value={taxa} onChange={(e) => setTaxa(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
              </div>
              <div>
                <Label className="text-slate-300">Prazo (meses)</Label>
                <Input value={prazo} onChange={(e) => setPrazo(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-white">Qual a taxa real desta operação?</p>
            <p className="mt-1 text-xs text-slate-400">
              Informe crédito, prazo e parcela de uma proposta (financiamento, consórcio contemplado etc.) para
              estimar a taxa mensal equivalente (Tabela Price).
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-slate-300">Valor do crédito (R$)</Label>
                <Input
                  value={valorCredito}
                  onChange={(e) => setValorCredito(e.target.value)}
                  className={cn("mt-1", surfaceInputDarkSlate)}
                />
              </div>
              <div>
                <Label className="text-slate-300">Prazo (meses)</Label>
                <Input value={prazoOp} onChange={(e) => setPrazoOp(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-slate-300">Valor da parcela (R$)</Label>
                <Input value={parcela} onChange={(e) => setParcela(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
              </div>
            </div>
          </>
        )}
        <Button type="button" variant="gold" className="mt-4 w-full min-h-12 sm:w-auto" onClick={calcular}>
          Calcular
        </Button>
      </div>

      {erroTaxa ? <p className="text-sm text-red-400">{erroTaxa}</p> : null}

      {resultInv ? (
        <CalculatorResultCard
          rows={[
            { label: "Valor inicial", value: formatCurrency(resultInv.valorInicial) },
            { label: "Rendimento estimado", value: formatCurrency(resultInv.rendimentoEstimado) },
            { label: "Valor futuro", value: formatCurrency(resultInv.valorFuturo), highlight: true },
          ]}
        />
      ) : null}

      {resultTaxa && !("erro" in resultTaxa) ? (
        <CalculatorResultCard
          rows={[
            { label: "Taxa mensal equivalente", value: formatPercent(resultTaxa.taxaMensalPercentual), highlight: true },
            {
              label: "Taxa anual equivalente (composta)",
              value: formatPercent(resultTaxa.taxaAnualEquivalentePercentual, 2),
            },
            { label: "Total pago no prazo", value: formatCurrency(resultTaxa.totalPago) },
            { label: "Juros totais estimados", value: formatCurrency(resultTaxa.jurosTotais) },
          ]}
        />
      ) : null}
    </div>
  );
}
