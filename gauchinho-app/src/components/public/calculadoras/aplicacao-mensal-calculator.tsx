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

function indiceDesatualizado(indice: IndicePublico | null): boolean {
  if (!indice?.ultima_atualizacao && !indice?.data_referencia) return true;
  const ref = indice.ultima_atualizacao ?? indice.data_referencia;
  if (!ref) return false;
  const d = new Date(ref.slice(0, 10));
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getUTCFullYear() < now.getUTCFullYear() || d.getUTCMonth() < now.getUTCMonth();
}

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

  return (
    <div className="space-y-5">
      <div className={sectionCardClass()}>
        <p className="text-sm font-semibold text-white">Aplicação com índices reais</p>
        <p className="mt-1 text-xs text-slate-400">{AVISO_APLICACAO}</p>

        {taxaInfo && perfil !== "comparar_todos" ? (
          <div className="mt-3 rounded-lg border border-slate-700/80 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
            <p className="font-semibold text-amber-200/90">Taxa usada no cálculo</p>
            {perfil === "cdi" && taxaInfo.cdiAnualBasePercentual != null ? (
              <>
                <p className="mt-1">CDI atual: {taxaInfo.cdiAnualBasePercentual.toFixed(2)}% a.a.</p>
                <p>Percentual usado: {percentualCdi}% do CDI</p>
                {taxaInfo.taxaAnualPercentual != null ? (
                  <p>Taxa anual usada: {taxaInfo.taxaAnualPercentual.toFixed(2)}% a.a.</p>
                ) : null}
                {taxaInfo.taxaMensalPercentual != null ? (
                  <p>Taxa mensal equivalente: {taxaInfo.taxaMensalPercentual.toFixed(2)}% a.m.</p>
                ) : null}
              </>
            ) : null}
            {perfil === "poupanca" && taxaInfo.taxaMensalPercentual != null ? (
              <p className="mt-1">
                Poupança: {taxaInfo.taxaMensalPercentual.toFixed(2)}% a.m.
                {taxaInfo.taxaAnualPercentual != null
                  ? ` · Taxa anual equivalente: ${taxaInfo.taxaAnualPercentual.toFixed(2)}% a.a.`
                  : ""}
              </p>
            ) : null}
            {perfil === "selic" && taxaInfo.taxaAnualPercentual != null ? (
              <>
                <p className="mt-1">Selic: {taxaInfo.taxaAnualPercentual.toFixed(2)}% a.a.</p>
                {taxaInfo.taxaMensalPercentual != null ? (
                  <p>Taxa mensal equivalente: {taxaInfo.taxaMensalPercentual.toFixed(2)}% a.m.</p>
                ) : null}
              </>
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
                Taxa manual ({taxaManualTipo === "anual" ? "anual" : "mensal"}):{" "}
                {num(taxaManual).toFixed(2)}% {taxaManualTipo === "anual" ? "a.a." : "a.m."}
                {taxaManualTipo === "anual" && taxaInfo.taxaMensalPercentual != null
                  ? ` · equivalente ${taxaInfo.taxaMensalPercentual.toFixed(2)}% a.m.`
                  : ""}
              </p>
            ) : null}
            {ultimaAtualizacao ? <p className="mt-1 text-slate-500">Última atualização: {ultimaAtualizacao}</p> : null}
            {indicePerfil?.fonte ? (
              <p className="text-slate-500">Fonte: {indicePerfil.fonte}</p>
            ) : perfil === "taxa_manual" ? (
              <p className="text-slate-500">Fonte: Cadastro manual</p>
            ) : null}
            {indicePerfil && indiceDesatualizado(indicePerfil) ? (
              <p className="mt-1 text-amber-300">Atenção: índice não atualizado neste mês.</p>
            ) : null}
            {indicePerfil?.usando_fallback ? (
              <p className="mt-1 text-amber-300">Usando último índice cadastrado no sistema.</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-slate-300">Valor inicial (R$)</Label>
            <MoneyInput
              value={valorInicial}
              onValueChange={setValorInicial}
              className={cn("mt-1", surfaceInputDarkSlate)}
            />
          </div>
          <div>
            <Label className="text-slate-300">Aporte mensal (R$)</Label>
            <MoneyInput
              value={aporte}
              onValueChange={setAporte}
              className={cn("mt-1", surfaceInputDarkSlate)}
            />
          </div>
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
              <option value="selic">Selic</option>
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
            <>
              <div>
                <Label className="text-slate-300">Tipo de taxa manual</Label>
                <Select
                  value={taxaManualTipo}
                  onChange={(e) => setTaxaManualTipo(e.target.value as "mensal" | "anual")}
                  className={cn("mt-1", surfaceSelectDark)}
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
                label="Parcela reduzida do consórcio (%)"
                value={parcelaReduzidaPct}
                onChange={setParcelaReduzidaPct}
                hint="Usado para estimar qual crédito caberia em uma parcela reduzida parecida com o aporte mensal."
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
                ...(result.taxaMensalEquivalente != null
                  ? [
                      {
                        label: "Taxa mensal usada",
                        value: `${result.taxaMensalEquivalente.toFixed(2)}% a.m.`,
                      },
                    ]
                  : []),
                ...(result.aumentoAnualAportePercentual > 0
                  ? [
                      {
                        label: "Aporte inicial mensal",
                        value: formatCurrency(aporte ?? 0),
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
              <p className="text-center text-xs leading-relaxed text-slate-400">
                {TEXTO_PARCELA_REDUZIDA_COMPARATIVO}
              </p>
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
                      label: "Período da comparação",
                      value: `${result.consorcio.periodoComparacaoMeses} meses`,
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
                  extra={
                    <p className="text-xs leading-relaxed text-slate-400">
                      {TEXTO_PRAZO_COMPARACAO_CONSORCIO}
                    </p>
                  }
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
