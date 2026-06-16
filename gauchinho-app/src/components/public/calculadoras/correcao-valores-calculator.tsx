"use client";

import { useState } from "react";
import { Button, Input, Label, Select, surfaceInputDarkSlate, surfaceSelectDark } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import { calcularCorrecaoValores } from "@/lib/calculadoras/correcao";
import type { TipoTaxaCorrecao } from "@/lib/calculadoras/types";
import { formatCurrency } from "@/lib/utils/format";
import { CalculatorResultCard } from "./calculator-result-card";
import { sectionCardClass } from "@/components/simulador/simulador-ui";

type Props = {
  onResult: (inputs: Record<string, unknown>, resultado: Record<string, unknown>) => void;
};

function num(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function CorrecaoValoresCalculator({ onResult }: Props) {
  const [valorInicial, setValorInicial] = useState("1000");
  const [percentual, setPercentual] = useState("1");
  const [tipoTaxa, setTipoTaxa] = useState<TipoTaxaCorrecao>("mensal");
  const [prazo, setPrazo] = useState("12");
  const [result, setResult] = useState<ReturnType<typeof calcularCorrecaoValores> | null>(null);

  function calcular() {
    const inputs = {
      valorInicial: num(valorInicial),
      percentualTaxa: num(percentual),
      tipoTaxa,
      prazoMeses: Math.floor(num(prazo)),
    };
    const r = calcularCorrecaoValores(inputs);
    setResult(r);
    onResult(inputs, r);
  }

  return (
    <div className="space-y-5">
      <div className={sectionCardClass()}>
        <p className="text-sm font-semibold text-white">Quanto vale hoje um valor corrigido por percentual?</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-slate-300">Valor inicial (R$)</Label>
            <Input value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
          </div>
          <div>
            <Label className="text-slate-300">Percentual de correção (%)</Label>
            <Input value={percentual} onChange={(e) => setPercentual(e.target.value)} className={cn("mt-1", surfaceInputDarkSlate)} />
          </div>
          <div>
            <Label className="text-slate-300">Tipo de taxa</Label>
            <Select
              value={tipoTaxa}
              onChange={(e) => setTipoTaxa(e.target.value as TipoTaxaCorrecao)}
              className={cn("mt-1", surfaceSelectDark)}
            >
              <option value="mensal">Mensal</option>
              <option value="anual">Anual</option>
            </Select>
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
            { label: "Correção acumulada", value: formatCurrency(result.correcaoAcumulada) },
            { label: "Valor corrigido", value: formatCurrency(result.valorCorrigido), highlight: true },
          ]}
        />
      ) : null}
    </div>
  );
}
