"use client";

import { useState } from "react";
import { Button, Input, Label, surfaceInputDarkSlate } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import { calcularAplicacaoMensal } from "@/lib/calculadoras/aplicacao";
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

export function AplicacaoMensalCalculator({ taxaPadrao, onResult }: Props) {
  const [valorInicial, setValorInicial] = useState("0");
  const [aporte, setAporte] = useState("500");
  const [taxa, setTaxa] = useState(String(taxaPadrao));
  const [prazo, setPrazo] = useState("24");
  const [result, setResult] = useState<ReturnType<typeof calcularAplicacaoMensal> | null>(null);

  function calcular() {
    const inputs = {
      valorInicial: num(valorInicial),
      aporteMensal: num(aporte),
      taxaMensalPercentual: num(taxa),
      prazoMeses: Math.floor(num(prazo)),
    };
    const r = calcularAplicacaoMensal(inputs);
    setResult(r);
    onResult(inputs, r);
  }

  return (
    <div className="space-y-5">
      <div className={sectionCardClass()}>
        <p className="text-sm font-semibold text-white">Quanto vou acumular investindo todos os meses?</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Valor inicial (R$)" value={valorInicial} onChange={setValorInicial} />
          <Field label="Aporte mensal (R$)" value={aporte} onChange={setAporte} />
          <Field label="Rentabilidade mensal (%)" value={taxa} onChange={setTaxa} step="0.01" />
          <Field label="Prazo (meses)" value={prazo} onChange={setPrazo} />
        </div>
        <Button type="button" variant="gold" className="mt-4 w-full min-h-12 sm:w-auto" onClick={calcular}>
          Calcular
        </Button>
      </div>
      {result ? (
        <CalculatorResultCard
          rows={[
            { label: "Total investido", value: formatCurrency(result.totalInvestido) },
            { label: "Rendimento estimado", value: formatCurrency(result.rendimentoEstimado) },
            { label: "Valor futuro", value: formatCurrency(result.valorFuturo), highlight: true },
          ]}
          extra={
            <div className="text-xs text-slate-400">
              <p className="mb-2 font-semibold text-slate-300">Evolução resumida</p>
              <ul className="space-y-1">
                {result.evolucaoResumida.map((p) => (
                  <li key={p.mes}>
                    Mês {p.mes}: {formatCurrency(p.saldo)}
                  </li>
                ))}
              </ul>
            </div>
          }
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div>
      <Label className="text-slate-300">{label}</Label>
      <Input
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("mt-1", surfaceInputDarkSlate)}
      />
    </div>
  );
}
