"use client";

import { useMemo, useState } from "react";
import { Button, Input, Label, Select, surfaceInputDarkSlate, surfaceSelectDark } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import { calcularCorrecaoAluguel, type IndiceAluguelCodigo } from "@/lib/calculadoras/aluguel";
import { formatDataReferenciaBr, percentualReajusteAluguel12m } from "@/lib/indices-financeiros";
import type { IndicePublico } from "@/lib/indices-financeiros/types";
import { formatCurrency } from "@/lib/utils/format";
import { CalculatorResultCard } from "./calculator-result-card";
import { sectionCardClass } from "@/components/simulador/simulador-ui";

type Props = {
  indices: IndicePublico[];
  onResult: (inputs: Record<string, unknown>, resultado: Record<string, unknown>) => void;
};

function num(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function findIndice(indices: IndicePublico[], codigo: string) {
  return indices.find((i) => i.codigo === codigo) ?? null;
}

export function CorrecaoValoresCalculator({ indices, onResult }: Props) {
  const [valorAtual, setValorAtual] = useState("2000");
  const [indice, setIndice] = useState<IndiceAluguelCodigo>("ipca");
  const [usarIndiceAtual, setUsarIndiceAtual] = useState(true);
  const [percentualManual, setPercentualManual] = useState("5");
  const [periodoMeses, setPeriodoMeses] = useState("12");
  const [result, setResult] = useState<ReturnType<typeof calcularCorrecaoAluguel> | null>(null);

  const indicePublico = useMemo(() => findIndice(indices, indice), [indices, indice]);
  const percentualIndice = useMemo(() => {
    if (!usarIndiceAtual || !indicePublico) return null;
    return percentualReajusteAluguel12m(indicePublico, num(percentualManual));
  }, [usarIndiceAtual, indicePublico, percentualManual]);

  const ultimaAtualizacao = formatDataReferenciaBr(
    indicePublico?.ultima_atualizacao?.slice(0, 10) ?? indicePublico?.data_referencia,
  );

  function calcular() {
    const inputs = {
      valorAtual: num(valorAtual),
      indice,
      usarIndiceAtual,
      percentualManual: num(percentualManual),
      periodoMeses: Math.floor(num(periodoMeses)),
    };
    const r = calcularCorrecaoAluguel({
      ...inputs,
      percentualIndice,
      indiceMeta: indicePublico ?? undefined,
    });
    setResult(r);
    onResult(
      {
        ...inputs,
        percentual_aplicado: r.percentualAplicado,
        novo_valor: r.novoValor,
        data_referencia_indice: r.data_referencia_indice,
      },
      r,
    );
  }

  return (
    <div className="space-y-5">
      <div className={sectionCardClass()}>
        <p className="text-sm font-semibold text-white">Correção de aluguel</p>
        <p className="mt-1 text-xs text-slate-400">
          A correção de aluguel depende do índice previsto em contrato. Use esta simulação apenas como estimativa.
        </p>
        {indicePublico && usarIndiceAtual && indice !== "taxa_manual" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            {indicePublico.atualizacao_automatica ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-300">
                Taxa atual
              </span>
            ) : null}
            {ultimaAtualizacao ? (
              <span>Última atualização: {ultimaAtualizacao}</span>
            ) : null}
            {indicePublico.usando_fallback ? (
              <span className="text-amber-300">Usando último índice cadastrado no sistema.</span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-slate-300">Valor atual do aluguel (R$)</Label>
            <Input
              value={valorAtual}
              onChange={(e) => setValorAtual(e.target.value)}
              className={cn("mt-1", surfaceInputDarkSlate)}
            />
          </div>
          <div>
            <Label className="text-slate-300">Índice de reajuste</Label>
            <Select
              value={indice}
              onChange={(e) => setIndice(e.target.value as IndiceAluguelCodigo)}
              className={cn("mt-1", surfaceSelectDark)}
            >
              <option value="ipca">IPCA</option>
              <option value="igpm">IGP-M</option>
              <option value="taxa_manual">Taxa manual</option>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">Período (meses)</Label>
            <Select
              value={periodoMeses}
              onChange={(e) => setPeriodoMeses(e.target.value)}
              className={cn("mt-1", surfaceSelectDark)}
            >
              <option value="12">12 meses</option>
              <option value="6">6 meses</option>
              <option value="24">24 meses</option>
              <option value="1">Outro (1 mês)</option>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">Usar índice atual</Label>
            <Select
              value={usarIndiceAtual ? "sim" : "nao"}
              onChange={(e) => setUsarIndiceAtual(e.target.value === "sim")}
              className={cn("mt-1", surfaceSelectDark)}
              disabled={indice === "taxa_manual"}
            >
              <option value="sim">Sim</option>
              <option value="nao">Não — percentual manual</option>
            </Select>
          </div>
          {!usarIndiceAtual || indice === "taxa_manual" ? (
            <div className="sm:col-span-2">
              <Label className="text-slate-300">Percentual manual (%)</Label>
              <Input
                value={percentualManual}
                onChange={(e) => setPercentualManual(e.target.value)}
                className={cn("mt-1", surfaceInputDarkSlate)}
              />
            </div>
          ) : percentualIndice != null ? (
            <div className="sm:col-span-2 text-xs text-slate-400">
              Índice usado: {indicePublico?.nome ?? indice} acumulado 12 meses ({percentualIndice}%).
              {ultimaAtualizacao ? ` Última atualização: ${ultimaAtualizacao}.` : null}
            </div>
          ) : (
            <div className="sm:col-span-2 text-xs text-amber-300">
              Índice indisponível — informe percentual manual ou cadastre no admin.
            </div>
          )}
        </div>
        <Button type="button" variant="gold" className="mt-4 w-full min-h-12 sm:w-auto" onClick={calcular}>
          Calcular reajuste
        </Button>
      </div>
      {result ? (
        <CalculatorResultCard
          rows={[
            { label: "Aluguel atual", value: formatCurrency(result.valorAtual) },
            { label: "Índice aplicado", value: `${result.percentualAplicado}%` },
            { label: "Reajuste", value: formatCurrency(result.valorReajuste) },
            { label: "Novo aluguel", value: formatCurrency(result.novoValor), highlight: true },
            { label: "Impacto anual", value: formatCurrency(result.diferencaAnual) },
          ]}
        />
      ) : null}
    </div>
  );
}
