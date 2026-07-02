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
  TEXTO_PARCELA_REDUZIDA_COMPARATIVO,
  TEXTO_PRAZO_COMPARACAO_CONSORCIO,
} from "@/lib/calculadoras/aplicacao-consorcio-comparativo";
import {
  buildTaxasPorPerfil,
  type PerfilAplicacaoCodigo,
} from "@/lib/calculadoras/aplicacao-comparativo";
import { DEFAULT_SIMULADOR_IMOVEL } from "@/lib/config/defaults";
import { percentualParcelaReduzidaPadrao } from "@/lib/config/simulador-parcela-opcoes";
import { formatDataReferenciaBr } from "@/lib/indices-financeiros";
import type { IndicePublico } from "@/lib/indices-financeiros/types";
import { formatCurrency } from "@/lib/utils/format";
import { CalculatorResultCard } from "./calculator-result-card";
import { sectionCardClass } from "@/components/simulador/simulador-ui";
import { MoneyInput } from "@/components/ui/money-input";

type Props = {
  indices: IndicePublico[];
  taxaPadrao: number;
  prefill?: { aporte: number; prazoMeses: number };
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

const PARCELA_REDUZIDA_PADRAO = String(percentualParcelaReduzidaPadrao(DEFAULT_SIMULADOR_IMOVEL));

export function AplicacaoMensalCalculator({ indices, taxaPadrao, prefill, onResult }: Props) {
  const [valorInicial, setValorInicial] = useState<number | null>(0);
  const [aporte, setAporte] = useState<number | null>(() => prefill?.aporte ?? 500);
  const [prazo, setPrazo] = useState(() =>
    prefill?.prazoMeses != null ? String(prefill.prazoMeses) : "120",
  );
  const [aumentoAnualAporte, setAumentoAnualAporte] = useState("6");
  const [compararConsorcio, setCompararConsorcio] = useState(true);
  const [reajusteCredito, setReajusteCredito] = useState("6");
  const [parcelaReduzidaPct, setParcelaReduzidaPct] = useState(PARCELA_REDUZIDA_PADRAO);
  const [prazoConsorcio, setPrazoConsorcio] = useState("220");
  const [perfil, setPerfil] = useState<PerfilAplicacaoCodigo | "comparar_todos">("cdi");
  const [cdiPreset, setCdiPreset] = useState("100");
  const [percentualCdiManual, setPercentualCdiManual] = useState("100");
  const [taxaManual, setTaxaManual] = useState(String(taxaPadrao));
  const [taxaManualTipo, setTaxaManualTipo] = useState<"mensal" | "anual">("mensal");
  const [result, setResult] = useState<ReturnType<typeof calcularAplicacaoComConsorcio> | null>(null);

  const percentualCdi = cdiPreset === "custom" ? num(percentualCdiManual) : num(cdiPreset);

  const taxaManualOpts = useMemo(
    () => ({
      taxaManualMensal: taxaManualTipo === "mensal" ? num(taxaManual) : undefined,
      taxaManualAnual: taxaManualTipo === "anual" ? num(taxaManual) : undefined,
    }),
    [taxaManual, taxaManualTipo],
  );

  const taxasPorPerfil = useMemo(
    () =>
      buildTaxasPorPerfil((p) => findIndice(indices, p), {
        percentualCdi,
        ...taxaManualOpts,
      }),
    [indices, percentualCdi, taxaManualOpts],
  );

  const indicePerfil =
    perfil !== "comparar_todos" && perfil !== "taxa_manual" ? findIndice(indices, perfil) : null;

  const taxaInfo = useMemo(() => {
    if (perfil === "comparar_todos") return null;
    return infoTaxaAplicacaoIndice(perfil, indicePerfil ?? findIndice(indices, perfil), {
      percentualCdi,
      ...taxaManualOpts,
    });
  }, [perfil, indicePerfil, indices, percentualCdi, taxaManualOpts]);

  const ultimaAtualizacao = formatDataReferenciaBr(taxaInfo?.ultimaAtualizacao);

  function calcular() {
    const inputs = {
      valorInicial: valorInicial ?? 0,
      aporteMensal: aporte ?? 0,
      prazoMeses: Math.floor(num(prazo)),
      perfil,
      percentualCdi,
      ...taxaManualOpts,
      aumentoAnualAportePercentual: num(aumentoAnualAporte),
      compararComConsorcio: compararConsorcio,
      reajusteAnualCreditoPercentual: num(reajusteCredito),
      prazoConsorcioMeses: Math.floor(num(prazoConsorcio)),
      percentualParcelaReduzidaConsorcio: num(parcelaReduzidaPct),
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

  const hasResult = result != null;
  const isCompararTodos = result?.perfilSelecionado === "comparar_todos";
  const showConsorcio = Boolean(result?.compararComConsorcio && result?.consorcio);

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
      {/* Formulário — coluna vertical estreita, fixa ao rolar no desktop */}
      <div className="lg:col-span-5 lg:sticky lg:top-24">
        <div className={sectionCardClass("border-amber-500/20 p-5 shadow-lg shadow-black/25 sm:p-6")}>
          <p className="text-base font-bold text-white">Configure sua simulação</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{AVISO_APLICACAO}</p>

          {taxaInfo && perfil !== "comparar_todos" ? (
            <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/40 px-4 py-3 text-xs text-slate-400">
              {perfil === "cdi" && taxaInfo.cdiAnualBasePercentual != null ? (
                <p>
                  CDI {taxaInfo.cdiAnualBasePercentual.toFixed(2)}% a.a. · {percentualCdi}% →{" "}
                  {taxaInfo.taxaAnualPercentual?.toFixed(2)}% a.a.
                  {taxaInfo.taxaMensalPercentual != null
                    ? ` (${taxaInfo.taxaMensalPercentual.toFixed(2)}% a.m.)`
                    : ""}
                </p>
              ) : (
                <p>
                  {taxaInfo.label}
                  {taxaInfo.taxaAnualPercentual != null
                    ? `: ${taxaInfo.taxaAnualPercentual.toFixed(2)}% a.a.`
                    : ""}
                  {taxaInfo.taxaMensalPercentual != null
                    ? ` · ${taxaInfo.taxaMensalPercentual.toFixed(2)}% a.m.`
                    : ""}
                </p>
              )}
              {ultimaAtualizacao ? <p className="mt-1 text-slate-500">Atualização: {ultimaAtualizacao}</p> : null}
            </div>
          ) : null}

          <FormSection title="Dados da aplicação">
            <div className="grid gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-200">Valor inicial</Label>
                <MoneyInput
                  value={valorInicial}
                  onValueChange={setValorInicial}
                  className={cn("mt-2 min-h-11", surfaceInputDarkSlate)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-200">Aporte mensal</Label>
                <MoneyInput
                  value={aporte}
                  onValueChange={setAporte}
                  className={cn("mt-2 min-h-11", surfaceInputDarkSlate)}
                />
              </div>
              <Field label="Prazo (meses)" value={prazo} onChange={setPrazo} />
              <Field
                label="Aumento anual do aporte (%)"
                value={aumentoAnualAporte}
                onChange={setAumentoAnualAporte}
                hint="A cada 12 meses, o aporte mensal será reajustado por esse percentual."
              />
            </div>
          </FormSection>

          <FormSection title="Perfil de rendimento">
            <div className="grid gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-200">Perfil de cálculo</Label>
                <Select
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value as PerfilAplicacaoCodigo | "comparar_todos")}
                  className={cn("mt-2 min-h-11", surfaceSelectDark)}
                >
                  <option value="poupanca">Poupança</option>
                  <option value="cdi">CDI</option>
                  <option value="selic">Selic</option>
                  <option value="tesouro_selic">Tesouro Selic</option>
                  <option value="tesouro_ipca">Tesouro IPCA+</option>
                  <option value="taxa_manual">Taxa manual</option>
                  <option value="comparar_todos">Comparar todos</option>
                </Select>
              </div>
              {perfil === "cdi" || perfil === "comparar_todos" ? (
                <div>
                  <Label className="text-sm font-medium text-slate-200">Percentual do CDI</Label>
                  <Select
                    value={cdiPreset}
                    onChange={(e) => setCdiPreset(e.target.value)}
                    className={cn("mt-2 min-h-11", surfaceSelectDark)}
                  >
                    <option value="100">100% do CDI</option>
                    <option value="90">90% do CDI</option>
                    <option value="110">110% do CDI</option>
                    <option value="custom">Manual</option>
                  </Select>
                  {cdiPreset === "custom" ? (
                    <Input
                      className={cn("mt-2 min-h-11", surfaceInputDarkSlate)}
                      value={percentualCdiManual}
                      onChange={(e) => setPercentualCdiManual(e.target.value)}
                      placeholder="% do CDI"
                    />
                  ) : null}
                </div>
              ) : null}
              {perfil === "taxa_manual" || perfil === "comparar_todos" ? (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-200">Tipo de taxa manual</Label>
                    <Select
                      value={taxaManualTipo}
                      onChange={(e) => setTaxaManualTipo(e.target.value as "mensal" | "anual")}
                      className={cn("mt-2 min-h-11", surfaceSelectDark)}
                    >
                      <option value="mensal">Mensal (% a.m.)</option>
                      <option value="anual">Anual (% a.a.)</option>
                    </Select>
                  </div>
                  <Field
                    label={taxaManualTipo === "anual" ? "Taxa manual anual (%)" : "Taxa manual mensal (%)"}
                    value={taxaManual}
                    onChange={setTaxaManual}
                    step="0.01"
                  />
                </>
              ) : null}
            </div>
          </FormSection>

          <FormSection title="Comparação com consórcio">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/30 px-4 py-3">
              <input
                type="checkbox"
                checked={compararConsorcio}
                onChange={(e) => setCompararConsorcio(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 accent-amber-400"
              />
              <span className="text-sm leading-snug text-slate-200">
                Comparar com consórcio programado
                <span className="mt-0.5 block text-xs text-slate-500">
                  Estime crédito e parcelas com base no seu aporte mensal.
                </span>
              </span>
            </label>
            {compararConsorcio ? (
              <div className="mt-4 grid gap-4">
                <Field
                  label="Reajuste anual do crédito (%)"
                  value={reajusteCredito}
                  onChange={setReajusteCredito}
                  hint="Estimativa de valorização/reajuste anual do crédito contratado."
                />
                <Field
                  label="Parcela reduzida (%)"
                  value={parcelaReduzidaPct}
                  onChange={setParcelaReduzidaPct}
                  hint="Crédito estimado com parcela reduzida parecida ao aporte."
                />
                <Field
                  label="Prazo do consórcio (meses)"
                  value={prazoConsorcio}
                  onChange={setPrazoConsorcio}
                />
              </div>
            ) : null}
          </FormSection>

          <Button
            type="button"
            variant="gold"
            className="mt-6 w-full min-h-12 text-base font-bold shadow-lg shadow-amber-900/25"
            onClick={calcular}
          >
            Calcular cenário
          </Button>
        </div>
      </div>

      {/* Resultados — coluna larga ao lado do formulário */}
      <div className="lg:col-span-7">
        {!hasResult ? (
          <div
            className={cn(
              sectionCardClass("border-dashed border-slate-700/60 p-8"),
              "flex min-h-[16rem] flex-col items-center justify-center text-center",
            )}
          >
            <p className="text-sm font-medium text-slate-400">Seu resultado aparece aqui</p>
            <p className="mt-1 text-xs text-slate-500">
              Preencha os dados ao lado e clique em Calcular cenário.
            </p>
          </div>
        ) : isCompararTodos ? (
          <div className="space-y-4">
            <div className={sectionCardClass("border-amber-500/25 p-5")}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Comparar todos</p>
              <p className="mt-2 text-sm text-slate-400">Melhor cenário estimado destacado abaixo.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {result!.comparativo.map((item) => (
                <div
                  key={item.codigo}
                  className={cn(
                    sectionCardClass("p-5"),
                    item.codigo === result!.melhorResultadoEstimado &&
                      "border-emerald-500/40 ring-1 ring-emerald-500/20",
                  )}
                >
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.taxaMensalPercentual.toFixed(2)}% a.m.</p>
                  <p className="mt-3 text-2xl font-extrabold text-amber-400">
                    {formatCurrency(item.resultado.valorFuturo)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {showConsorcio ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-400/95">
                  Comparativo patrimonial
                </p>
                <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                  Aplicação mensal × Consórcio programado
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">{TEXTO_PARCELA_REDUZIDA_COMPARATIVO}</p>
              </div>
            ) : null}

            <div className={cn("grid gap-4", showConsorcio && "sm:grid-cols-2")}>
              <CalculatorResultCard
                title="Resultado da aplicação"
                variant="accent"
                heroMetric={{
                  label: "Valor final estimado",
                  value: formatCurrency(result!.valorFinalEstimado),
                }}
                rows={[
                  { label: "Total investido", value: formatCurrency(result!.totalInvestido) },
                  { label: "Rendimento estimado", value: formatCurrency(result!.rendimentoEstimado) },
                  ...(result!.taxaAnualUsada != null
                    ? [{ label: "Índice usado", value: `${result!.taxaAnualUsada.toFixed(2)}% a.a.` }]
                    : []),
                  ...(result!.taxaMensalEquivalente != null
                    ? [
                        {
                          label: "Taxa mensal equivalente",
                          value: `${result!.taxaMensalEquivalente.toFixed(2)}% a.m.`,
                        },
                      ]
                    : []),
                  { label: "Prazo da aplicação", value: `${Math.floor(num(prazo))} meses` },
                  ...(ultimaAtualizacao
                    ? [{ label: "Última atualização", value: ultimaAtualizacao }]
                    : []),
                ]}
                extra={
                  result!.comparativo.some((c) => c.estimativaTesouro) ? (
                    <p className="text-xs leading-relaxed text-slate-400">{AVISO_TESOURO}</p>
                  ) : null
                }
              />

              {showConsorcio && result!.consorcio ? (
                <CalculatorResultCard
                  title="Consórcio programado"
                  variant="default"
                  heroMetric={{
                    label: "Crédito reajustado estimado",
                    value: formatCurrency(result!.consorcio.creditoReajustadoConsorcio),
                  }}
                  rows={[
                    {
                      label: "Parcela reduzida estimada",
                      value: formatCurrency(result!.consorcio.parcelaReduzidaEstimada),
                    },
                    {
                      label: "Parcela integral estimada",
                      value: formatCurrency(result!.consorcio.parcelaIntegralEstimada),
                    },
                    {
                      label: "Reajuste anual usado",
                      value: `${result!.consorcio.reajusteAnualCreditoPercentual.toFixed(2)}% a.a.`,
                    },
                    {
                      label: "Prazo do consórcio",
                      value: `${result!.consorcio.prazoConsorcioMeses} meses`,
                    },
                  ]}
                  extra={
                    <p className="text-xs leading-relaxed text-slate-500">{TEXTO_PRAZO_COMPARACAO_CONSORCIO}</p>
                  }
                />
              ) : null}
            </div>

            {showConsorcio && result!.consorcio && result!.diferencaPatrimonial != null ? (
              <CalculatorResultCard
                title="Diferença patrimonial"
                variant="sell"
                heroMetric={{
                  label: "Diferença estimada",
                  value: formatCurrency(result!.diferencaPatrimonial),
                }}
                rows={[
                  {
                    label: "Crédito reajustado (consórcio)",
                    value: formatCurrency(result!.consorcio.creditoReajustadoConsorcio),
                  },
                  {
                    label: "Valor final da aplicação",
                    value: formatCurrency(result!.valorFinalEstimado),
                  },
                ]}
                extra={
                  <>
                    <p className="text-sm leading-relaxed text-slate-300">{TEXTO_DIFERENCA_PATRIMONIAL}</p>
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">{AVISO_COMPARATIVO_CONSORCIO}</p>
                  </>
                }
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-slate-800/90 pt-6 first:mt-4 first:border-0 first:pt-0">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-sm font-medium text-slate-200">{label}</Label>
      <Input
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("mt-2 min-h-11", surfaceInputDarkSlate)}
      />
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}
