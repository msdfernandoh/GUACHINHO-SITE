"use client";

import { useMemo, useState } from "react";
import { Button, Input, Label, Select, surfaceInputDarkSlate, surfaceSelectDark } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import {
  calcularAplicacaoComparativo,
  type PerfilAplicacaoCodigo,
} from "@/lib/calculadoras/aplicacao-comparativo";
import { formatDataReferenciaBr, taxaMensalAplicacaoFromIndice } from "@/lib/indices-financeiros";
import type { IndicePublico } from "@/lib/indices-financeiros/types";
import { formatCurrency } from "@/lib/utils/format";
import { CalculatorResultCard } from "./calculator-result-card";
import { sectionCardClass } from "@/components/simulador/simulador-ui";

type Props = {
  indices: IndicePublico[];
  taxaPadrao: number;
  onResult: (inputs: Record<string, unknown>, resultado: Record<string, unknown>) => void;
};

function num(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function findIndice(indices: IndicePublico[], codigo: string) {
  return indices.find((i) => i.codigo === codigo) ?? null;
}

const AVISO_APLICACAO =
  "Resultado estimado. Não considera impostos, taxas, inflação futura, custos operacionais ou variação de mercado. Consulte um especialista antes de tomar decisão financeira.";

const AVISO_TESOURO =
  "Estimativa com base na taxa cadastrada. Não considera impostos, taxas, marcação a mercado ou custos operacionais.";

export function AplicacaoMensalCalculator({ indices, taxaPadrao, onResult }: Props) {
  const [valorInicial, setValorInicial] = useState("10000");
  const [aporte, setAporte] = useState("500");
  const [prazo, setPrazo] = useState("120");
  const [perfil, setPerfil] = useState<PerfilAplicacaoCodigo | "comparar_todos">("cdi");
  const [cdiPreset, setCdiPreset] = useState("100");
  const [percentualCdiManual, setPercentualCdiManual] = useState("100");
  const [taxaManual, setTaxaManual] = useState(String(taxaPadrao));
  const [result, setResult] = useState<ReturnType<typeof calcularAplicacaoComparativo> | null>(null);

  const percentualCdi = cdiPreset === "custom" ? num(percentualCdiManual) : num(cdiPreset);

  const taxasPorPerfil = useMemo(() => {
    const map: Partial<Record<PerfilAplicacaoCodigo, number>> = {};
    const perfis: PerfilAplicacaoCodigo[] = [
      "poupanca",
      "cdi",
      "tesouro_selic",
      "tesouro_ipca",
      "taxa_manual",
    ];
    for (const p of perfis) {
      const taxa = taxaMensalAplicacaoFromIndice(p, findIndice(indices, p), {
        percentualCdi,
        taxaManualMensal: num(taxaManual),
      });
      if (taxa != null) map[p] = taxa;
    }
    return map;
  }, [indices, percentualCdi, taxaManual]);

  const indicePerfil = perfil !== "comparar_todos" ? findIndice(indices, perfil) : null;
  const ultimaAtualizacao = formatDataReferenciaBr(
    indicePerfil?.ultima_atualizacao?.slice(0, 10) ?? indicePerfil?.data_referencia,
  );

  function calcular() {
    const inputs = {
      valorInicial: num(valorInicial),
      aporteMensal: num(aporte),
      prazoMeses: Math.floor(num(prazo)),
      perfil,
      percentualCdi,
      taxaManualMensal: num(taxaManual),
    };
    const r = calcularAplicacaoComparativo({
      ...inputs,
      taxasPorPerfil,
    });
    setResult(r);
    onResult(
      {
        ...inputs,
        opcoes_comparadas:
          perfil === "comparar_todos"
            ? r.comparativo.map((c) => c.codigo)
            : [perfil],
        melhor_resultado_estimado: r.melhorResultadoEstimado,
      },
      r,
    );
  }

  return (
    <div className="space-y-5">
      <div className={sectionCardClass()}>
        <p className="text-sm font-semibold text-white">Aplicação com índices reais</p>
        <p className="mt-1 text-xs text-slate-400">{AVISO_APLICACAO}</p>
        {indicePerfil && perfil !== "comparar_todos" && perfil !== "taxa_manual" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            {indicePerfil.atualizacao_automatica ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-300">
                Taxa atual
              </span>
            ) : null}
            {ultimaAtualizacao ? <span>Última atualização: {ultimaAtualizacao}</span> : null}
            {indicePerfil.usando_fallback ? (
              <span className="text-amber-300">Usando último índice cadastrado no sistema.</span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Valor inicial (R$)" value={valorInicial} onChange={setValorInicial} />
          <Field label="Aporte mensal (R$)" value={aporte} onChange={setAporte} />
          <Field label="Prazo (meses)" value={prazo} onChange={setPrazo} />
          <div>
            <Label className="text-slate-300">Perfil de cálculo</Label>
            <Select
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as PerfilAplicacaoCodigo | "comparar_todos")}
              className={cn("mt-1", surfaceSelectDark)}
            >
              <option value="poupanca">Poupança</option>
              <option value="cdi">CDI</option>
              <option value="tesouro_selic">Tesouro Selic</option>
              <option value="tesouro_ipca">Tesouro IPCA+</option>
              <option value="taxa_manual">Taxa manual</option>
              <option value="comparar_todos">Comparar todos</option>
            </Select>
          </div>
          {perfil === "cdi" || perfil === "comparar_todos" ? (
            <div>
              <Label className="text-slate-300">Percentual do CDI</Label>
              <Select
                value={cdiPreset}
                onChange={(e) => setCdiPreset(e.target.value)}
                className={cn("mt-1", surfaceSelectDark)}
              >
                <option value="100">100% do CDI</option>
                <option value="90">90% do CDI</option>
                <option value="110">110% do CDI</option>
                <option value="custom">Manual</option>
              </Select>
              {cdiPreset === "custom" ? (
                <Input
                  className={cn("mt-2", surfaceInputDarkSlate)}
                  value={percentualCdiManual}
                  onChange={(e) => setPercentualCdiManual(e.target.value)}
                  placeholder="% do CDI"
                />
              ) : null}
            </div>
          ) : null}
          {perfil === "taxa_manual" || perfil === "comparar_todos" ? (
            <Field
              label="Rentabilidade manual mensal (%)"
              value={taxaManual}
              onChange={setTaxaManual}
              step="0.01"
            />
          ) : null}
        </div>
        <Button type="button" variant="gold" className="mt-4 w-full min-h-12 sm:w-auto" onClick={calcular}>
          Calcular
        </Button>
      </div>

      {result ? (
        <>
          {result.perfilSelecionado !== "comparar_todos" ? (
            <CalculatorResultCard
              rows={[
                { label: "Total investido", value: formatCurrency(result.totalInvestido) },
                { label: "Rendimento estimado", value: formatCurrency(result.rendimentoEstimado) },
                { label: "Valor final estimado", value: formatCurrency(result.valorFinalEstimado), highlight: true },
              ]}
              extra={
                result.comparativo.some((c) => c.estimativaTesouro) ? (
                  <p className="text-xs text-slate-400">{AVISO_TESOURO}</p>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {result.comparativo.map((item) => (
                <div
                  key={item.codigo}
                  className={cn(
                    sectionCardClass(),
                    item.codigo === result.melhorResultadoEstimado && "border-emerald-500/40",
                  )}
                >
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Taxa mensal: {item.taxaMensalPercentual.toFixed(2)}% a.m.
                  </p>
                  <p className="mt-2 text-lg font-semibold text-amber-300">
                    {formatCurrency(item.resultado.valorFuturo)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Rendimento: {formatCurrency(item.resultado.rendimentoEstimado)}
                  </p>
                  {item.estimativaTesouro ? (
                    <p className="mt-2 text-[11px] text-slate-500">{AVISO_TESOURO}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
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
