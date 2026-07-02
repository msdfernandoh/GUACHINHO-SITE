"use client";

import { useState } from "react";
import { Button, Input, Label, surfaceInputDarkSlate } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import { calcularTaxaRealDoBem } from "@/lib/calculadoras/juros-real";
import { formatCurrency } from "@/lib/utils/format";
import { CalculatorResultCard } from "./calculator-result-card";
import { sectionCardClass } from "@/components/simulador/simulador-ui";
import { MoneyInput } from "@/components/ui/money-input";

type Props = {
  onResult: (inputs: Record<string, unknown>, resultado: Record<string, unknown>) => void;
};

function num(v: string) {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function JurosRealCalculator({ onResult }: Props) {
  const [valorBem, setValorBem] = useState<number | null>(100_000);
  const [entrada, setEntrada] = useState<number | null>(0);
  const [parcela, setParcela] = useState<number | null>(2500);
  const [prazo, setPrazo] = useState("60");
  const [result, setResult] = useState<ReturnType<typeof calcularTaxaRealDoBem> | null>(null);

  function calcular() {
    const inputs = {
      valorBem: valorBem ?? 0,
      entrada: entrada ?? 0,
      parcela: parcela ?? 0,
      prazoMeses: Math.floor(num(prazo)),
    };
    const r = calcularTaxaRealDoBem(inputs.valorBem, inputs.entrada, inputs.parcela, inputs.prazoMeses);
    setResult(r);
    onResult(inputs, r.ok ? { ...r, tipo_calculadora: "juros_real" } : { ok: false, motivo: r.ok ? "" : r.motivo });
  }

  return (
    <div className="space-y-5">
      <div className={sectionCardClass()}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Valor do bem / financiado</Label>
            <MoneyInput className={cn("mt-1", surfaceInputDarkSlate)} value={valorBem} onValueChange={setValorBem} />
          </div>
          <div>
            <Label>Entrada (opcional)</Label>
            <MoneyInput className={cn("mt-1", surfaceInputDarkSlate)} value={entrada} onValueChange={setEntrada} />
          </div>
          <div>
            <Label>Valor da parcela</Label>
            <MoneyInput className={cn("mt-1", surfaceInputDarkSlate)} value={parcela} onValueChange={setParcela} />
          </div>
          <div>
            <Label>Prazo (meses)</Label>
            <Input className={cn("mt-1", surfaceInputDarkSlate)} value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>
        <Button type="button" variant="gold" className="mt-4" onClick={calcular}>
          Calcular juros real
        </Button>
      </div>

      {result ? (
        result.ok ? (
          <CalculatorResultCard
            title="Juros real da parcela"
            rows={[
              { label: "Valor financiado", value: formatCurrency(result.valorFinanciado) },
              {
                label: "Taxa mensal aprox.",
                value: `${result.taxaMensalPercentual.toFixed(2)}% a.m.`,
                highlight: true,
              },
              { label: "Taxa anual aprox.", value: `${result.taxaAnualPercentual.toFixed(2)}% a.a.` },
              { label: "Total pago", value: formatCurrency(result.totalPago) },
              { label: "Juros totais", value: formatCurrency(result.jurosTotais) },
            ]}
          />
        ) : (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {result.motivo}
          </p>
        )
      ) : null}
    </div>
  );
}
