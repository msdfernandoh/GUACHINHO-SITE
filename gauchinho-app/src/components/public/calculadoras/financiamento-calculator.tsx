"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Label, Select, surfaceInputDarkSlate, surfaceSelectDark } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import { calcularFinanciamentoCalculadora } from "@/lib/calculadoras/financiamento-calc";
import { formatCurrency } from "@/lib/utils/format";
import { CalculatorResultCard } from "./calculator-result-card";
import { sectionCardClass } from "@/components/simulador/simulador-ui";
import { MoneyInput } from "@/components/ui/money-input";

type Props = {
  taxaPadrao: number;
  onResult: (inputs: Record<string, unknown>, resultado: Record<string, unknown>) => void;
};

function num(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function FinanciamentoCalculator({ taxaPadrao, onResult }: Props) {
  const [valorBem, setValorBem] = useState<number | null>(300_000);
  const [entrada, setEntrada] = useState<number | null>(60_000);
  const [taxa, setTaxa] = useState(String(taxaPadrao));
  const [prazo, setPrazo] = useState("240");
  const [tipoBem, setTipoBem] = useState<"imovel" | "automovel">("imovel");
  const [result, setResult] = useState<ReturnType<typeof calcularFinanciamentoCalculadora> | null>(null);

  function calcular() {
    const inputs = {
      valorBem: valorBem ?? 0,
      entrada: entrada ?? 0,
      taxaMensalPercentual: num(taxa),
      prazoMeses: Math.floor(num(prazo)),
      tipoBem,
    };
    const r = calcularFinanciamentoCalculadora(inputs);
    setResult(r);
    onResult(inputs, r);
  }

  const simLink =
    result != null
      ? `/simulador?solucao=consorcio&tipo=${tipoBem}&valor=${Math.round(valorBem ?? 0)}`
      : null;

  return (
    <div className="space-y-5">
      <div className={sectionCardClass()}>
        <p className="text-sm font-semibold text-white">Quanto ficaria uma prestação financiada?</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-slate-300">Valor do bem (R$)</Label>
            <MoneyInput value={valorBem} onValueChange={setValorBem} className={cn("mt-1", surfaceInputDarkSlate)} />
          </div>
          <div>
            <Label className="text-slate-300">Entrada (R$)</Label>
            <MoneyInput value={entrada} onValueChange={setEntrada} className={cn("mt-1", surfaceInputDarkSlate)} />
          </div>
          <div>
            <Label className="text-slate-300">Taxa mensal (%)</Label>
            <Input value={taxa} onChange={(e) => setTaxa(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
          </div>
          <div>
            <Label className="text-slate-300">Prazo (meses)</Label>
            <Input value={prazo} onChange={(e) => setPrazo(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-slate-300">Tipo de bem (comparar consórcio)</Label>
            <Select
              value={tipoBem}
              onChange={(e) => setTipoBem(e.target.value as "imovel" | "automovel")}
              className={cn("mt-1", surfaceSelectDark)}
            >
              <option value="imovel">Imóvel</option>
              <option value="automovel">Automóvel</option>
            </Select>
          </div>
        </div>
        <Button type="button" variant="gold" className="mt-4 w-full min-h-12 sm:w-auto" onClick={calcular}>
          Calcular
        </Button>
      </div>
      {result ? (
        <CalculatorResultCard
          rows={[
            { label: "Valor financiado", value: formatCurrency(result.valorFinanciado) },
            { label: "Parcela estimada", value: formatCurrency(result.parcelaEstimada), highlight: true },
            { label: "Total pago", value: formatCurrency(result.valorTotalPago) },
            { label: "Juros totais", value: formatCurrency(result.jurosTotais) },
            { label: "Custo final", value: formatCurrency(result.custoFinal) },
          ]}
          extra={
            simLink ? (
              <Link
                href={simLink}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 text-sm font-semibold text-amber-300 hover:bg-amber-500/20"
              >
                Comparar com consórcio
              </Link>
            ) : null
          }
        />
      ) : null}
    </div>
  );
}
