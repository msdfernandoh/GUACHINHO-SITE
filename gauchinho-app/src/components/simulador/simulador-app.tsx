"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SimuladorTipoBemConfig } from "@/lib/config/defaults";
import { opcoesParcelaAtivas } from "@/lib/config/simulador-parcela-opcoes";
import {
  calcularContemplacaoPrimeiroMes,
  calcularFundoReservaTotal,
  calcularLancePorTipo,
  calcularParcelaConsorcio,
  calcularTaxaAdministrativaTotal,
  type EntradaConsorcio,
  type ModoLanceInput,
} from "@/lib/simulador/consorcio";
import { simularFinanciamento } from "@/lib/simulador/financiamento";
import { compararConsorcioFinanciamento, detalharAlternativaConsorcio, montarEntradaFinanciamentoComparativo } from "@/lib/simulador/comparativo";
import { gerarProjecaoAnoAno } from "@/lib/simulador/projecao";
import { digitsOnlyPhone } from "@/lib/utils/format";
import { Button } from "@/components/ui/form-primitives";
import { SimuladorPageShell } from "./simulador-page-shell";
import { SolutionSelector } from "./solution-selector";
import { AssetTypeSelector } from "./asset-type-selector";
import { CreditValueStep } from "./credit-value-step";
import { PrazoStep } from "./prazo-step";
import { PaymentStrategyStep } from "./payment-strategy-step";
import { AdvancedStrategyAccordion } from "./advanced-strategy-accordion";
import { FinanciamentoDetailsStep } from "./financiamento-details-step";
import { ConsorcioResultCards } from "./consorcio-result-cards";
import { FinanciamentoResultCards } from "./financiamento-result-cards";
import { ComparisonSection } from "./comparison-section";
import { SimuladorCalculadoraAplicacaoCta } from "./simulador-calculadora-aplicacao-cta";
import { ProjectionSection } from "./projection-section";
import { LeadCaptureModal } from "./lead-capture-modal";
import type {
  AcaoCaptura,
  Modo,
  SimuladorConfigs,
  TipoBem,
} from "./simulador-types";

export type { SimuladorConfigs } from "./simulador-types";
export { AVISO_PROJECAO } from "./simulador-types";

import {
  listPrazosConsorcio,
  listPrazosFinanciamento,
  snapPrazoToLista,
  resolveFinanciamentoCfg,
} from "@/lib/simulador/simulador-shared";
import {
  entradaFinanciamentoParaCalculo,
  entradaPadraoFinanciamento,
  taxaMensalFinanciamentoCalculo,
} from "@/lib/simulador/financiamento-entrada";

function clampValorBemFinanciamento(valor: number, bem: SimuladorTipoBemConfig) {
  return Math.min(bem.valorMaximoCredito, Math.max(bem.valorMinimoCredito, valor));
}

function buildEntradaConsorcio(
  valorCredito: number,
  prazo: number,
  taxaAdm: number,
  fundoReserva: number,
  seguro: number,
  lanceProprio: number,
  lanceEmbutido: number,
  reajusteCredito: number,
  correcaoParcela: number,
  percentualParcelaInicial: number,
): EntradaConsorcio {
  return {
    valorCredito,
    prazoMeses: prazo,
    taxaAdministrativaPercentual: taxaAdm,
    fundoReservaPercentual: fundoReserva,
    seguroPrestamistaPercentual: seguro,
    entrada: lanceProprio,
    lanceEmbutido,
    reajusteAnualCredito: reajusteCredito,
    correcaoAnualParcela: correcaoParcela,
    percentualParcelaInicial,
  };
}

function parcelaConsorcioParaPrazo(
  base: Omit<EntradaConsorcio, "prazoMeses">,
  prazoMeses: number,
  percentualParcela: number,
) {
  return calcularParcelaConsorcio({
    ...base,
    prazoMeses,
    percentualParcelaInicial: percentualParcela,
  }).parcelaEstimada;
}

function primeiraOpcaoId(cfg: SimuladorTipoBemConfig) {
  return opcoesParcelaAtivas(cfg)[0]?.id ?? "integral";
}

export type SimuladorPrefill = {
  valor?: number;
  tipo?: TipoBem;
  origem?: string;
  imovelId?: string;
  solucao?: Modo;
  prazo?: number;
};

export function SimuladorApp({
  configs,
  prefill,
}: {
  configs: SimuladorConfigs;
  prefill?: SimuladorPrefill;
}) {
  const resultRef = useRef<HTMLDivElement>(null);
  const prefillAppliedRef = useRef(false);

  const [modo, setModo] = useState<Modo>("consorcio");
  const [tipoBem, setTipoBem] = useState<TipoBem>("imovel");
  const [avancado, setAvancado] = useState(false);
  const [opcaoParcelaId, setOpcaoParcelaId] = useState(() => primeiraOpcaoId(configs.imovel));
  const [resultoDestacado, setResultoDestacado] = useState(false);
  const [tabelaAberta, setTabelaAberta] = useState(false);

  const [capturaOpen, setCapturaOpen] = useState(false);
  const [capturaAcao, setCapturaAcao] = useState<AcaoCaptura>("analise");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cidade, setCidade] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [pdfLink, setPdfLink] = useState<string | null>(null);

  const bemCfg =
    tipoBem === "automovel" ? configs.automovel : configs.imovel;
  const finCfg = useMemo(
    () => resolveFinanciamentoCfg(configs, tipoBem),
    [configs, tipoBem],
  );

  const [valorCredito, setValorCredito] = useState(bemCfg.valorPadraoInicial);
  const [prazo, setPrazo] = useState(bemCfg.prazoPadrao);
  const [taxaAdm, setTaxaAdm] = useState(bemCfg.taxaAdministrativaPadrao);
  const [fundoReserva, setFundoReserva] = useState(bemCfg.fundoReservaPadrao);
  const [seguro, setSeguro] = useState(bemCfg.seguroPrestamistaPadrao);
  const [reajusteCredito, setReajusteCredito] = useState(bemCfg.reajusteAnualCredito);
  const [correcaoParcela, setCorrecaoParcela] = useState(bemCfg.correcaoAnualParcela);
  const [lanceProprioModo, setLanceProprioModo] = useState<ModoLanceInput>("percent");
  const [lanceEmbutidoModo, setLanceEmbutidoModo] = useState<ModoLanceInput>("percent");
  const [lanceProprioInput, setLanceProprioInput] = useState(0);
  const [lanceEmbutidoInput, setLanceEmbutidoInput] = useState(0);

  const [valorBem, setValorBem] = useState(bemCfg.valorPadraoInicial);
  const [entradaFin, setEntradaFin] = useState(() =>
    entradaPadraoFinanciamento(bemCfg.valorPadraoInicial, finCfg),
  );
  const [taxaMensal, setTaxaMensal] = useState(finCfg.taxaMensalPadrao);
  const [prazoFin, setPrazoFin] = useState(finCfg.prazoPadrao);

  const opcoesParcela = useMemo(() => opcoesParcelaAtivas(bemCfg), [bemCfg]);
  const opcaoSelecionada = useMemo(
    () => opcoesParcela.find((o) => o.id === opcaoParcelaId) ?? opcoesParcela[0],
    [opcoesParcela, opcaoParcelaId],
  );
  const percentualParcela = opcaoSelecionada?.percentual ?? 100;

  const saldoDevedorBaseLance = useMemo(() => {
    const taxa = calcularTaxaAdministrativaTotal(valorCredito, taxaAdm);
    const fundo = calcularFundoReservaTotal(valorCredito, fundoReserva);
    return valorCredito + taxa + fundo;
  }, [valorCredito, taxaAdm, fundoReserva]);

  const lanceProprioValor = useMemo(
    () => calcularLancePorTipo(saldoDevedorBaseLance, lanceProprioInput, lanceProprioModo),
    [saldoDevedorBaseLance, lanceProprioInput, lanceProprioModo],
  );
  const lanceEmbutidoValor = useMemo(
    () => calcularLancePorTipo(saldoDevedorBaseLance, lanceEmbutidoInput, lanceEmbutidoModo),
    [saldoDevedorBaseLance, lanceEmbutidoInput, lanceEmbutidoModo],
  );
  const lanceTotal = lanceProprioValor + lanceEmbutidoValor;

  useEffect(() => {
    if (!opcoesParcela.length) return;
    if (!opcoesParcela.some((o) => o.id === opcaoParcelaId)) {
      setOpcaoParcelaId(opcoesParcela[0].id);
    }
  }, [opcoesParcela, opcaoParcelaId]);

  useEffect(() => {
    if (!prefill || prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;
    if (prefill.solucao === "consorcio" || prefill.solucao === "financiamento") {
      setModo(prefill.solucao);
    }
    if (prefill.tipo === "imovel" || prefill.tipo === "automovel") {
      setTipoBem(prefill.tipo);
    }
    const cfgBem =
      prefill.tipo === "automovel" ? configs.automovel : configs.imovel;
    if (prefill.valor != null && Number.isFinite(prefill.valor) && prefill.valor > 0) {
      const vCred = clampValorBemFinanciamento(prefill.valor, cfgBem);
      setValorCredito(vCred);
      const vBem = clampValorBemFinanciamento(prefill.valor, cfgBem);
      setValorBem(vBem);
      setEntradaFin(entradaPadraoFinanciamento(vBem, finCfg));
    }
    if (prefill.prazo != null && Number.isFinite(prefill.prazo) && prefill.prazo > 0) {
      setPrazo(prefill.prazo);
      const prazos = listPrazosFinanciamento(finCfg);
      setPrazoFin(snapPrazoToLista(prefill.prazo, prazos, finCfg.prazoPadrao));
    }
    if (prefill.origem === "oportunidade_imobiliaria") {
      setModo("consorcio");
      setTipoBem("imovel");
    }
  }, [prefill, finCfg, configs.automovel, configs.imovel]);

  const prazosConsorcio = useMemo(() => listPrazosConsorcio(bemCfg), [bemCfg]);

  const prazosFin = useMemo(
    () => listPrazosFinanciamento(finCfg),
    [finCfg],
  );

  const taxaMensalCalc = useMemo(
    () => taxaMensalFinanciamentoCalculo(taxaMensal, finCfg),
    [taxaMensal, finCfg],
  );

  const entradaFinCalc = useMemo(
    () => entradaFinanciamentoParaCalculo(valorBem, entradaFin),
    [valorBem, entradaFin],
  );

  const updateValorBemFin = useCallback(
    (raw: number) => {
      const v = clampValorBemFinanciamento(raw, bemCfg);
      setValorBem(v);
      setEntradaFin(entradaPadraoFinanciamento(v, finCfg));
    },
    [bemCfg, finCfg],
  );

  useEffect(() => {
    if (!prazosFin.length) return;
    setPrazoFin((p) => snapPrazoToLista(p, prazosFin, finCfg.prazoPadrao));
  }, [prazosFin, finCfg.prazoPadrao]);

  const entradaConsorcio = useMemo(
    () =>
      buildEntradaConsorcio(
        valorCredito,
        prazo,
        taxaAdm,
        fundoReserva,
        seguro,
        lanceProprioValor,
        lanceEmbutidoValor,
        reajusteCredito,
        correcaoParcela,
        percentualParcela,
      ),
    [
      valorCredito,
      prazo,
      taxaAdm,
      fundoReserva,
      seguro,
      lanceProprioValor,
      lanceEmbutidoValor,
      reajusteCredito,
      correcaoParcela,
      percentualParcela,
    ],
  );

  const baseConsorcioSemPrazo = useMemo(
    () => ({
      valorCredito,
      taxaAdministrativaPercentual: taxaAdm,
      fundoReservaPercentual: fundoReserva,
      seguroPrestamistaPercentual: seguro,
      entrada: lanceProprioValor,
      lanceEmbutido: lanceEmbutidoValor,
      reajusteAnualCredito: reajusteCredito,
      correcaoAnualParcela: correcaoParcela,
      percentualParcelaInicial: percentualParcela,
    }),
    [
      valorCredito,
      taxaAdm,
      fundoReserva,
      seguro,
      lanceProprioValor,
      lanceEmbutidoValor,
      reajusteCredito,
      correcaoParcela,
      percentualParcela,
    ],
  );

  const contemplacao = useMemo(
    () => calcularContemplacaoPrimeiroMes(entradaConsorcio),
    [entradaConsorcio],
  );

  const resultadoFin = useMemo(
    () =>
      simularFinanciamento({
        valorBem,
        entrada: entradaFinCalc,
        taxaMensalPercentual: taxaMensalCalc,
        prazoMeses: prazoFin,
      }),
    [valorBem, entradaFinCalc, taxaMensalCalc, prazoFin],
  );

  const entradaConsorcioComparativo = useMemo(() => {
    if (modo !== "financiamento") return entradaConsorcio;
    return buildEntradaConsorcio(
      valorBem,
      prazoFin,
      taxaAdm,
      fundoReserva,
      seguro,
      0,
      0,
      reajusteCredito,
      correcaoParcela,
      100,
    );
  }, [
    modo,
    entradaConsorcio,
    valorBem,
    prazoFin,
    taxaAdm,
    fundoReserva,
    seguro,
    reajusteCredito,
    correcaoParcela,
  ]);

  const comparativo = useMemo(() => {
    const entradaFinCmp = montarEntradaFinanciamentoComparativo({
      modo,
      valorCreditoConsorcio: valorCredito,
      prazoConsorcioMeses: prazo,
      valorBemFinanciamento: valorBem,
      entradaFinanciamento: entradaFinCalc,
      prazoFinanciamentoMeses: prazoFin,
      taxaMensalPercentual: taxaMensalCalc,
    });
    return compararConsorcioFinanciamento(entradaConsorcioComparativo, entradaFinCmp);
  }, [
    modo,
    entradaConsorcioComparativo,
    valorCredito,
    valorBem,
    entradaFinCalc,
    taxaMensalCalc,
    prazo,
    prazoFin,
  ]);

  const projecao = useMemo(() => {
    if (modo !== "consorcio" || !bemCfg.mostrarTabelaAnoAno) return [];
    return gerarProjecaoAnoAno(entradaConsorcio);
  }, [modo, entradaConsorcio, bemCfg.mostrarTabelaAnoAno]);

  const resumoAno1 = projecao[0];

  const parcelaForPrazoConsorcio = useCallback(
    (meses: number) => parcelaConsorcioParaPrazo(baseConsorcioSemPrazo, meses, percentualParcela),
    [baseConsorcioSemPrazo, percentualParcela],
  );

  const parcelaForPrazoFin = useCallback(
    (meses: number) =>
      simularFinanciamento({
        valorBem,
        entrada: entradaFinCalc,
        taxaMensalPercentual: taxaMensalCalc,
        prazoMeses: meses,
      }).parcelaEstimada,
    [valorBem, entradaFinCalc, taxaMensalCalc],
  );

  function aplicarDefaultsBem(b: TipoBem) {
    if (b !== "imovel" && b !== "automovel") return;
    const c = b === "imovel" ? configs.imovel : configs.automovel;
    const prazos = listPrazosFinanciamento(finCfg);
    setValorCredito(c.valorPadraoInicial);
    setValorBem(c.valorPadraoInicial);
    setPrazo(c.prazoPadrao);
    setEntradaFin(entradaPadraoFinanciamento(c.valorPadraoInicial, finCfg));
    setTaxaMensal(finCfg.taxaMensalPadrao);
    setPrazoFin(snapPrazoToLista(c.prazoPadrao, prazos, finCfg.prazoPadrao));
    setTaxaAdm(c.taxaAdministrativaPadrao);
    setFundoReserva(c.fundoReservaPadrao);
    setSeguro(c.seguroPrestamistaPadrao);
    setReajusteCredito(c.reajusteAnualCredito);
    setCorrecaoParcela(c.correcaoAnualParcela);
    setLanceProprioInput(0);
    setLanceEmbutidoInput(0);
    setOpcaoParcelaId(primeiraOpcaoId(c));
  }

  function handleModoChange(m: Modo) {
    setModo(m);
    setResultoDestacado(false);
    setMsg(null);
    if (m === "financiamento") {
      const v = clampValorBemFinanciamento(valorCredito, bemCfg);
      const prazos = listPrazosFinanciamento(finCfg);
      setValorBem(v);
      setEntradaFin(entradaPadraoFinanciamento(v, finCfg));
      setTaxaMensal(finCfg.taxaMensalPadrao);
      setPrazoFin(snapPrazoToLista(prazoFin, prazos, finCfg.prazoPadrao));
    }
  }

  function scrollToResult() {
    setResultoDestacado(true);
    setTabelaAberta(bemCfg.exibirTabelaCompletaPorPadrao ?? false);
    setMsg(null);
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openCaptura(acao: AcaoCaptura) {
    setCapturaAcao(acao);
    setCapturaOpen(true);
    setMsg(null);
  }

  async function submitCaptura(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setWaLink(null);
    try {
      const resultadoPayload =
        modo === "consorcio"
          ? {
              ...contemplacao,
              opcaoParcela: opcaoSelecionada,
              comparativo,
            }
          : { ...resultadoFin, comparativo };
      const res = await fetch("/api/public/simulador/captura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp: digitsOnlyPhone(whatsapp),
          cidade,
          email: email.trim() || undefined,
          modo,
          tipoBem:
            modo === "consorcio" || modo === "financiamento"
              ? tipoBem === "automovel"
                ? "automovel"
                : "imovel"
              : undefined,
          acao: capturaAcao,
          entrada:
            modo === "consorcio"
              ? entradaConsorcio
              : {
                  valorBem,
                  entrada: entradaFin,
                  taxaMensalPercentual: taxaMensal,
                  prazoMeses: prazoFin,
                },
          resultado: resultadoPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha");
      setCapturaOpen(false);
      setPdfLink((data.pdfPath as string) ?? (data.pdfDownloadUrl as string) ?? null);
      setMsg(
        capturaAcao === "proposta"
          ? "Proposta básica criada com PDF premium."
          : "Dados registrados. Em breve um especialista entrará em contato.",
      );
      const wa = data.whatsappOrigem;
      if (wa?.exibir_botao_apos_lead && wa?.whatsapp_destino) {
        const text = encodeURIComponent(wa.mensagem_padrao ?? "Olá, simulei no site Gauchinho.");
        setWaLink(`https://wa.me/${wa.whatsapp_destino.replace(/\D/g, "")}?text=${text}`);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  const alternativaConsorcio = useMemo(() => {
    if (modo !== "financiamento") return null;
    return detalharAlternativaConsorcio(entradaConsorcioComparativo, bemCfg);
  }, [modo, entradaConsorcioComparativo, bemCfg]);

  const mostrarComparativo =
    (modo === "consorcio" && bemCfg.mostrarComparacaoFinanciamento) ||
    (modo === "financiamento" && finCfg.mostrarComparacaoConsorcio);

  const avisoLance =
    lanceTotal > contemplacao.saldoDevedorEstimado
      ? "Lance total superior ao saldo devedor estimado."
      : null;

  const estrategiaLabel = opcaoSelecionada
    ? `${opcaoSelecionada.nome} (${percentualParcela}% da parcela integral)`
    : "Parcela integral";

  const footerCta =
    resultoDestacado ? (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 p-3 backdrop-blur sm:hidden">
        <div className="flex gap-2">
          <Button type="button" variant="gold" className="min-h-11 flex-1" onClick={() => openCaptura("proposta")}>
            Gerar proposta
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800"
            onClick={() => openCaptura("especialista")}
          >
            Especialista
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <SimuladorPageShell footer={footerCta}>
      <div className="space-y-5 sm:space-y-6">
        <SolutionSelector value={modo} onChange={handleModoChange} />
        <AssetTypeSelector
          modo={modo}
          value={tipoBem}
          onChange={(b) => {
            setTipoBem(b);
            aplicarDefaultsBem(b);
          }}
        />

        {modo === "consorcio" ? (
          <>
            <CreditValueStep
              title="1. Valor do crédito"
              valueLabel="Valor do crédito desejado"
              value={valorCredito}
              min={bemCfg.valorMinimoCredito}
              max={bemCfg.valorMaximoCredito}
              onChange={setValorCredito}
            />
            <PrazoStep
              prazos={prazosConsorcio}
              selected={prazo}
              onSelect={setPrazo}
              parcelaForPrazo={parcelaForPrazoConsorcio}
            />
            {opcoesParcela.length ? (
              <PaymentStrategyStep
                opcoes={opcoesParcela}
                selectedId={opcaoParcelaId}
                onSelect={setOpcaoParcelaId}
                parcelaAmortizacao={contemplacao.parcelaAmortizacao}
                seguroMensal={contemplacao.seguroMensal}
              />
            ) : null}
            <AdvancedStrategyAccordion
              open={avancado}
              onToggle={() => setAvancado((v) => !v)}
              valorCredito={valorCredito}
              lanceProprioModo={lanceProprioModo}
              onLanceProprioModo={setLanceProprioModo}
              lanceProprioInput={lanceProprioInput}
              onLanceProprioInput={setLanceProprioInput}
              lanceProprioValor={lanceProprioValor}
              lanceEmbutidoModo={lanceEmbutidoModo}
              onLanceEmbutidoModo={setLanceEmbutidoModo}
              lanceEmbutidoInput={lanceEmbutidoInput}
              onLanceEmbutidoInput={setLanceEmbutidoInput}
              lanceEmbutidoValor={lanceEmbutidoValor}
              lanceTotal={lanceTotal}
              taxaAdm={taxaAdm}
              onTaxaAdm={setTaxaAdm}
              fundoReserva={fundoReserva}
              onFundoReserva={setFundoReserva}
              seguro={seguro}
              onSeguro={setSeguro}
              reajusteCredito={reajusteCredito}
              onReajusteCredito={setReajusteCredito}
              correcaoParcela={correcaoParcela}
              onCorrecaoParcela={setCorrecaoParcela}
              avisoLance={avisoLance}
            />
          </>
        ) : (
          <>
            <CreditValueStep
              title="1. Valor do bem"
              valueLabel="Valor do bem"
              value={valorBem}
              min={bemCfg.valorMinimoCredito}
              max={bemCfg.valorMaximoCredito}
              onChange={updateValorBemFin}
            />
            <PrazoStep
              prazos={prazosFin}
              selected={prazoFin}
              onSelect={setPrazoFin}
              parcelaForPrazo={parcelaForPrazoFin}
            />
            <FinanciamentoDetailsStep
              entrada={entradaFin}
              onEntrada={setEntradaFin}
              taxaMensal={taxaMensal}
              onTaxaMensal={setTaxaMensal}
              valorBem={valorBem}
            />
          </>
        )}

        <Button
          type="button"
          variant="gold"
          className="min-h-14 w-full text-base font-bold sm:text-lg"
          onClick={scrollToResult}
        >
          Ver simulação completa
        </Button>

        <div
          ref={resultRef}
          className={
            resultoDestacado ? "space-y-5 scroll-mt-6 ring-2 ring-amber-400/20 rounded-2xl p-1" : "space-y-5"
          }
        >
          {modo === "consorcio" ? (
            <ConsorcioResultCards contemplacao={contemplacao} estrategiaLabel={estrategiaLabel} />
          ) : (
            <FinanciamentoResultCards
              resultado={resultadoFin}
              valorBem={valorBem}
              entrada={entradaFin}
              taxaMensal={taxaMensal}
            />
          )}

          {modo === "consorcio" && bemCfg.mostrarTabelaAnoAno ? (
            <ProjectionSection
              resumoAno1={resumoAno1}
              projecao={projecao}
              tabelaAberta={tabelaAberta}
              onToggleTabela={() => setTabelaAberta((v) => !v)}
            />
          ) : null}

          {mostrarComparativo ? (
            <ComparisonSection
              modo={modo}
              comparativo={comparativo}
              alternativaConsorcio={alternativaConsorcio}
            />
          ) : null}

          <SimuladorCalculadoraAplicacaoCta
            aporte={modo === "consorcio" ? contemplacao.parcelaEstimada : resultadoFin.parcelaEstimada}
            prazoMeses={modo === "consorcio" ? prazo : prazoFin}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="gold"
              className="min-h-12 flex-1 text-base sm:min-w-[12rem]"
              onClick={() => openCaptura("proposta")}
            >
              Gerar proposta
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 flex-1 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 sm:min-w-[12rem]"
              onClick={() => openCaptura("analise")}
            >
              Ver análise completa
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 flex-1 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 sm:min-w-[12rem]"
              onClick={() => openCaptura("especialista")}
            >
              Falar com especialista
            </Button>
          </div>
        </div>

        {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
        {pdfLink ? (
          <a href={pdfLink} target="_blank" rel="noreferrer" className="inline-block text-sm text-amber-400 underline">
            Baixar proposta PDF
          </a>
        ) : null}
        {waLink ? (
          <a href={waLink} target="_blank" rel="noreferrer" className="inline-block text-sm text-amber-400 underline">
            Abrir WhatsApp
          </a>
        ) : null}

        <p className="pt-4 text-center text-sm text-slate-500">
          <Link href="/grupos" className="font-medium text-amber-400 hover:underline">
            Ver grupos disponíveis
          </Link>
        </p>
      </div>

      <LeadCaptureModal
        open={capturaOpen}
        acao={capturaAcao}
        nome={nome}
        whatsapp={whatsapp}
        cidade={cidade}
        email={email}
        loading={loading}
        onClose={() => setCapturaOpen(false)}
        onSubmit={submitCaptura}
        onNome={setNome}
        onWhatsapp={setWhatsapp}
        onCidade={setCidade}
        onEmail={setEmail}
      />
    </SimuladorPageShell>
  );
}
