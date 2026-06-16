"use client";

import { useState } from "react";
import { Button, Input, Label, surfaceInputDarkSlate } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import { calcularValorFuturo } from "@/lib/calculadoras/valor-futuro";
import { formatCurrency } from "@/lib/utils/format";
import { CalculatorResultCard } from "./calculator-result-card";
import { sectionCardClass } from "@/components/simulador/simulador-ui";

type Props = {
  taxaPadrao: number;
  onResult: (inputs: Record<string, unknown>, resultado: Record<string, unknown>) => void;
};

function num(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function ValorFuturoCalculator({ taxaPadrao, onResult }: Props) {
  const [valorInicial, setValorInicial] = useState("10000");
  const [taxa, setTaxa] = useState(String(taxaPadrao));
  const [prazo, setPrazo] = useState("12");
  const [result, setResult] = useState<ReturnType<typeof calcularValorFuturo> | null>(null);

  function calcular() {
    const inputs = {
      valorInicial: num(valorInicial),
      taxaMensalPercentual: num(taxa),
      prazoMeses: Math.floor(num(prazo)),
    };
    const r = calcularValorFuturo(inputs);
    setResult(r);
    onResult(inputs, r);
  }

  return (
    <div className="space-y-5">
      <div className={sectionCardClass()}>
        <p className="text-sm font-semibold text-white">Quanto um valor pode render ao longo do tempo?</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-slate-300">Valor inicial (R$)</Label>
            <Input value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
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
        <Button type="button" variant="gold" className="mt-4 w-full min-h-12 sm:w-auto" onClick={calcular}>
          Calcular
        </Button>
      </div>
      {result ? (
        <CalculatorResultCard
          rows={[
            { label: "Valor inicial", value: formatCurrency(result.valorInicial) },
            { label: "Rendimento estimado", value: formatCurrency(result.rendimentoEstimado) },
            { label: "Valor futuro", value: formatCurrency(result.valorFuturo), highlight: true },
          ]}
        />
      ) : null}
    </div>
  );
}
