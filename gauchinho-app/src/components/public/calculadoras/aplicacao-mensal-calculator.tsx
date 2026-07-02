"use client";

import { useMemo, useState } from "react";
import { Button, Input, Label, Select, surfaceInputDarkSlate, surfaceSelectDark } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import {
  calcularAplicacaoComConsorcio,
  infoTaxaAplicacaoIndice,
  leadPayloadAplicacaoConsorcio,
  AVISO_COMPARATIVO_CONSORCIO,
  TEXTO_DIFERENCA_PATRIMONIAL,
} from "@/lib/calculadoras/aplicacao-consorcio-comparativo";
import type { PerfilAplicacaoCodigo } from "@/lib/calculadoras/aplicacao-comparativo";
import { formatDataReferenciaBr, taxaMensalAplicacaoFromIndice } from "@/lib/indices-financeiros";
import { taxaMensalParaAnualPercentual } from "@/lib/indices-financeiros/math";
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
  const [valorInicial, setValorInicial] = useState("0");
  const [aporte, setAporte] = useState("500");
  const [prazo, setPrazo] = useState("120");
  const [aumentoAnualAporte, setAumentoAnualAporte] = useState("6");
  const [compararConsorcio, setCompararConsorcio] = useState(true);
  const [reajusteCredito, setReajusteCredito] = useState("6");
  const [prazoConsorcio, setPrazoConsorcio] = useState("220");
  const [perfil, setPerfil] = useState<PerfilAplicacaoCodigo | "comparar_todos">("cdi");
  const [cdiPreset, setCdiPreset] = useState("100");
  const [percentualCdiManual, setPercentualCdiManual] = useState("100");
  const [taxaManual, setTaxaManual] = useState(String(taxaPadrao));
  const [result, setResult] = useState<ReturnType<typeof calcularAplicacaoComConsorcio> | null>(null);

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

  const indicePerfil =
    perfil !== "comparar_todos" && perfil !== "taxa_manual" ? findIndice(indices, perfil) : null;

  const taxaInfo = useMemo(() => {
    if (perfil === "comparar_todos") return null;
    return infoTaxaAplicacaoIndice(perfil, indicePerfil ?? findIndice(indices, perfil), {
      percentualCdi,
      taxaManualMensal: num(taxaManual),
    });
  }, [perfil, indicePerfil, indices, percentualCdi, taxaManual]);

  const ultimaAtualizacao = formatDataReferenciaBr(taxaInfo?.ultimaAtualizacao);

  function calcular() {
    const inputs = {
      valorInicial: num(valorInicial),
      aporteMensal: num(aporte),
      prazoMeses: Math.floor(num(prazo)),
      perfil,
      percentualCdi,
      taxaManualMensal: num(taxaManual),
      aumentoAnualAportePercentual: num(aumentoAnualAporte),
      compararComConsorcio: compararConsorcio,
      reajusteAnualCreditoPercentual: num(reajusteCredito),
      prazoConsorcioMeses: Math.floor(num(prazoConsorcio)),
      percentualParcelaReduzidaConsorcio: 60,
    };
    const r = calcularAplicacaoComConsorcio({
      ...inputs,
      taxasPorPerfil,
      indicePrincipal: indicePerfil,
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
      { ...r, lead: leadPayloadAplicacaoConsorcio({ ...inputs, taxasPorPerfil }, r) },
    );
  }

  return (
    <div className="space-y-5">
      <div className={sectionCardClass()}>
        <p className="text-sm font-semibold text-white">Aplicação com índices reais</p>
        <p className="mt-1 text-xs text-slate-400">{AVISO_APLICACAO}</p>

        {taxaInfo && perfil !== "comparar_todos" ? (
          <div className="mt-3 rounded-lg border border-slate-700/80 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
            <p className="font-semibold text-amber-200/90">Taxa usada no cálculo</p>
            {perfil === "cdi" && taxaInfo.taxaAnualPercentual != null ? (
              <>
                <p className="mt-1">
                  CDI atual: {taxaInfo.taxaAnualPercentual.toFixed(2)}% a.a.
                  {percentualCdi !== 100 ? ` (${percentualCdi}% do CDI)` : ""}
                </p>
                {taxaInfo.taxaMensalPercentual != null ? (
                  <p>Taxa mensal equivalente: {taxaInfo.taxaMensalPercentual.toFixed(2)}% a.m.</p>
                ) : null}
              </>
            ) : null}
            {perfil === "poupanca" && taxaInfo.taxaMensalPercentual != null ? (
              <p className="mt-1">
                Poupança: {taxaInfo.taxaMensalPercentual.toFixed(2)}% a.m.
                {taxaInfo.taxaAnualPercentual != null
                  ? ` / ${taxaInfo.taxaAnualPercentual.toFixed(2)}% a.a.`
                  : ` / ${taxaMensalParaAnualPercentual(taxaInfo.taxaMensalPercentual).toFixed(2)}% a.a.`}
              </p>
            ) : null}
            {(perfil === "tesouro_selic" || perfil === "tesouro_ipca") &&
            taxaInfo.taxaAnualPercentual != null ? (
              <>
                <p className="mt-1">
                  {taxaInfo.label}: {taxaInfo.taxaAnualPercentual.toFixed(2)}% a.a.
                </p>
                {taxaInfo.taxaMensalPercentual != null ? (
                  <p>Taxa mensal equivalente: {taxaInfo.taxaMensalPercentual.toFixed(2)}% a.m.</p>
                ) : null}
              </>
            ) : null}
            {perfil === "taxa_manual" && taxaInfo.taxaMensalPercentual != null ? (
              <p className="mt-1">
                Taxa manual informada: {taxaInfo.taxaMensalPercentual.toFixed(2)}% a.m.
              </p>
            ) : null}
            {ultimaAtualizacao ? <p className="mt-1 text-slate-500">Última atualização: {ultimaAtualizacao}</p> : null}
            {indicePerfil?.fonte ? (
              <p className="text-slate-500">Fonte: {indicePerfil.fonte}</p>
            ) : null}
            {indicePerfil?.usando_fallback ? (
              <p className="mt-1 text-amber-300">Usando último índice cadastrado no sistema.</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Valor inicial (R$)" value={valorInicial} onChange={setValorInicial} />
          <Field label="Aporte mensal (R$)" value={aporte} onChange={setAporte} />
          <Field label="Prazo (meses)" value={prazo} onChange={setPrazo} />
          <Field
            label="Aumento anual do aporte (%)"
            value={aumentoAnualAporte}
            onChange={setAumentoAnualAporte}
            hint="A cada 12 meses, o aporte mensal será reajustado por esse percentual."
          />
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
          <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={compararConsorcio}
              onChange={(e) => setCompararConsorcio(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600"
            />
            <span className="text-sm text-slate-300">Comparar com consórcio</span>
          </label>
          {compararConsorcio ? (
            <>
              <Field
                label="Reajuste anual do crédito (%)"
                value={reajusteCredito}
                onChange={setReajusteCredito}
                hint="Estimativa de valorização/reajuste anual do crédito contratado."
              />
              <Field
                label="Prazo do consórcio (meses)"
                value={prazoConsorcio}
                onChange={setPrazoConsorcio}
                hint="Usado para estimar o crédito com parcela reduzida parecida ao aporte."
              />
            </>
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
              title="Aplicação financeira"
              rows={[
                { label: "Total investido", value: formatCurrency(result.totalInvestido) },
                { label: "Rendimento estimado", value: formatCurrency(result.rendimentoEstimado) },
                {
                  label: "Valor final estimado",
                  value: formatCurrency(result.valorFinalEstimado),
                  highlight: true,
                },
                ...(result.aumentoAnualAportePercentual > 0
                  ? [
                      {
                        label: "Aporte inicial mensal",
                        value: formatCurrency(num(aporte)),
                      },
                      {
                        label: "Reajuste anual do aporte",
                        value: `${result.aumentoAnualAportePercentual.toFixed(2)}% a.a.`,
                      },
                    ]
                  : []),
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

          {result.compararComConsorcio && result.consorcio ? (
            <section className="space-y-4">
              <h2 className="text-center text-lg font-bold text-white">
                Aplicação mensal x Consórcio programado
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <CalculatorResultCard
                  title="Consórcio programado (estimativa)"
                  rows={[
                    {
                      label: "Parcela reduzida estimada",
                      value: formatCurrency(result.consorcio.parcelaReduzidaEstimada),
                    },
                    {
                      label: "Crédito contratado estimado",
                      value: formatCurrency(result.consorcio.creditoContratadoEstimado),
                      highlight: true,
                    },
                    {
                      label: "Parcela integral estimada",
                      value: formatCurrency(result.consorcio.parcelaIntegralEstimada),
                    },
                    {
                      label: "Crédito reajustado no período",
                      value: formatCurrency(result.consorcio.creditoReajustadoConsorcio),
                    },
                    {
                      label: "Reajuste anual usado",
                      value: `${result.consorcio.reajusteAnualCreditoPercentual.toFixed(2)}% a.a.`,
                    },
                    {
                      label: "Prazo do consórcio",
                      value: `${result.consorcio.prazoConsorcioMeses} meses`,
                    },
                    {
                      label: "Saldo devedor estimado",
                      value: formatCurrency(result.consorcio.saldoDevedorEstimado),
                    },
                  ]}
                />
                {result.diferencaPatrimonial != null ? (
                  <CalculatorResultCard
                    title="Diferença patrimonial estimada"
                    rows={[
                      {
                        label: "Valor final da aplicação",
                        value: formatCurrency(result.valorFinalEstimado),
                      },
                      {
                        label: "Crédito reajustado (consórcio)",
                        value: formatCurrency(result.consorcio.creditoReajustadoConsorcio),
                      },
                      {
                        label: "Diferença estimada",
                        value: formatCurrency(result.diferencaPatrimonial),
                        highlight: true,
                      },
                    ]}
                    extra={
                      <p className="text-xs leading-relaxed text-slate-400">{TEXTO_DIFERENCA_PATRIMONIAL}</p>
                    }
                  />
                ) : null}
              </div>
              <p className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-4 py-3 text-xs leading-relaxed text-slate-400">
                {AVISO_COMPARATIVO_CONSORCIO}
              </p>
            </section>
          ) : null}
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
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  hint?: string;
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
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}
