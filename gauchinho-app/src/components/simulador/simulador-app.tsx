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
import { useTenantBrand } from "@/components/tenant/tenant-brand-context";
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
import { PropostaLinkModal } from "@/components/contratacao/proposta-link-modal";
import { useIniciarContratacao } from "@/lib/contratacoes-online/use-iniciar-contratacao";
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
  clampValorCreditoTipo,
  parseTipoBemFromQuery,
  resolveBemConfigSimulador,
} from "@/lib/simulador/tipos-credito";
import {
  entradaFinanciamentoParaCalculo,
  entradaPadraoFinanciamento,
  taxaMensalFinanciamentoCalculo,
} from "@/lib/simulador/financiamento-entrada";

function clampValorBemFinanciamento(valor: number, tipo: TipoBem, configs: SimuladorConfigs) {
  return clampValorCreditoTipo(tipo, valor, configs);
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
  isConsultor = false,
}: {
  configs: SimuladorConfigs;
  prefill?: SimuladorPrefill;
  isConsultor?: boolean;
}) {
  const tenantBrand = useTenantBrand();
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
  const [contratarEscolhaOpen, setContratarEscolhaOpen] = useState(false);
  const [consultores, setConsultores] = useState<{ id: string; nome: string }[]>([]);
  const [consultorId, setConsultorId] = useState("");
  const [linkModal, setLinkModal] = useState<{
    protocolo: string;
    url: string;
    credito: number | null;
    parcela: number | null;
    tipoBem: string | null;
  } | null>(null);
  const { iniciar: iniciarContratacao, loading: contratacaoLoading } = useIniciarContratacao();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/consultores")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.consultores) return;
        setConsultores(data.consultores as { id: string; nome: string }[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const bemCfg = useMemo(
    () => resolveBemConfigSimulador(tipoBem, configs),
    [tipoBem, configs],
  );
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
  const [aplicarParcelaReduzidaPersonalizada, setAplicarParcelaReduzidaPersonalizada] =
    useState(false);
  const [percentualParcelaPersonalizada, setPercentualParcelaPersonalizada] = useState(40);

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
  const percentualParcelaBase = opcaoSelecionada?.percentual ?? 100;
  const percentualParcelaPersonalizadaClamped = Math.min(
    99,
    Math.max(1, Math.round(percentualParcelaPersonalizada) || 40),
  );
  const percentualParcela =
    aplicarParcelaReduzidaPersonalizada &&
    percentualParcelaPersonalizadaClamped > 0 &&
    percentualParcelaPersonalizadaClamped < 100 &&
    percentualParcelaBase < 100
      ? percentualParcelaPersonalizadaClamped
      : percentualParcelaBase;

  const percentualReduzidaOverride =
    aplicarParcelaReduzidaPersonalizada &&
    percentualParcelaPersonalizadaClamped > 0 &&
    percentualParcelaPersonalizadaClamped < 100
      ? percentualParcelaPersonalizadaClamped
      : null;

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
    if (prefill.tipo) {
      setTipoBem(prefill.tipo);
    }
    const tipoPref = prefill.tipo ?? "imovel";
    const cfgBem = resolveBemConfigSimulador(tipoPref, configs);
    const finPref = resolveFinanciamentoCfg(configs, tipoPref);
    if (prefill.valor != null && Number.isFinite(prefill.valor) && prefill.valor > 0) {
      const vCred = clampValorBemFinanciamento(prefill.valor, tipoPref, configs);
      setValorCredito(vCred);
      const vBem = clampValorBemFinanciamento(prefill.valor, tipoPref, configs);
      setValorBem(vBem);
      setEntradaFin(entradaPadraoFinanciamento(vBem, finPref));
    }
    if (prefill.prazo != null && Number.isFinite(prefill.prazo) && prefill.prazo > 0) {
      setPrazo(prefill.prazo);
      const prazos = listPrazosFinanciamento(finPref);
      setPrazoFin(snapPrazoToLista(prefill.prazo, prazos, finPref.prazoPadrao));
    }
    if (prefill.origem === "oportunidade_imobiliaria") {
      setModo("consorcio");
      setTipoBem("imovel");
    }
  }, [prefill, configs]);

  useEffect(() => {
    if (modo === "financiamento" && (tipoBem === "moto" || tipoBem === "caminhoes_frota")) {
      setTipoBem("automovel");
    }
  }, [modo, tipoBem]);

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
      const v = clampValorBemFinanciamento(raw, tipoBem, configs);
      setValorBem(v);
      setEntradaFin(entradaPadraoFinanciamento(v, finCfg));
    },
    [tipoBem, configs, finCfg],
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
    const c = resolveBemConfigSimulador(b, configs);
    const fin = resolveFinanciamentoCfg(configs, b);
    const prazos = listPrazosFinanciamento(fin);
    const v = clampValorCreditoTipo(b, c.valorPadraoInicial, configs);
    setValorCredito(v);
    setValorBem(v);
    setPrazo(c.prazoPadrao);
    setEntradaFin(entradaPadraoFinanciamento(v, fin));
    setTaxaMensal(fin.taxaMensalPadrao);
    setPrazoFin(snapPrazoToLista(c.prazoPadrao, prazos, fin.prazoPadrao));
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
      const tipoFin = tipoBem === "imovel" ? "imovel" : "automovel";
      if (tipoBem !== tipoFin) {
        setTipoBem(tipoFin);
        aplicarDefaultsBem(tipoFin);
        return;
      }
      const v = clampValorBemFinanciamento(valorCredito, tipoBem, configs);
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

  function buildDadosSimulacaoPayload() {
    const opcaoParcelaPayload =
      aplicarParcelaReduzidaPersonalizada &&
      percentualParcela < 100 &&
      opcaoSelecionada &&
      opcaoSelecionada.percentual < 100
        ? {
            ...opcaoSelecionada,
            id: "personalizada",
            nome: `${percentualParcela}% da parcela`,
            percentual: percentualParcela,
            descricao: "Parcela reduzida personalizada",
          }
        : opcaoSelecionada;
    const resultadoPayload =
      modo === "consorcio"
        ? {
            ...contemplacao,
            opcaoParcela: opcaoParcelaPayload,
            parcelaReduzidaPersonalizada: aplicarParcelaReduzidaPersonalizada,
            percentualParcelaPersonalizada: aplicarParcelaReduzidaPersonalizada
              ? percentualParcela
              : null,
            comparativo,
          }
        : { ...resultadoFin, comparativo };
    return {
      modo,
      tipoBem:
        modo === "consorcio" || modo === "financiamento"
          ? tipoBem === "automovel"
            ? "automovel"
            : "imovel"
          : undefined,
      entrada:
        modo === "consorcio"
          ? {
              ...entradaConsorcio,
              parcelaReduzidaPersonalizada: aplicarParcelaReduzidaPersonalizada,
              percentualParcelaPersonalizada: aplicarParcelaReduzidaPersonalizada
                ? percentualParcela
                : null,
            }
          : {
              valorBem,
              entrada: entradaFin,
              taxaMensalPercentual: taxaMensal,
              prazoMeses: prazoFin,
            },
      resultado: resultadoPayload,
    };
  }

  async function executarContratacao(modoContrat: "cliente_site" | "sdr_link") {
    setMsg(null);
    const consultor = consultores.find((c) => c.id === consultorId);
    if (!isConsultor && !consultor) {
      setMsg("Selecione o consultor responsável pela proposta.");
      setContratarEscolhaOpen(true);
      return;
    }
    try {
      const result = await iniciarContratacao({
        modo: modoContrat,
        origem: "simulador",
        dados_simulacao: buildDadosSimulacaoPayload(),
        redirectCliente: modoContrat === "cliente_site",
        consultor_id: consultor?.id,
        consultor_nome: consultor?.nome,
      });
      if (modoContrat === "sdr_link" && result) {
        setLinkModal({
          protocolo: result.protocolo,
          url: result.url,
          credito: modo === "consorcio" ? valorCredito : valorBem,
          parcela:
            modo === "consorcio" ? contemplacao.parcelaEstimada : resultadoFin.parcelaEstimada,
          tipoBem: tipoBem === "automovel" ? "Veículo" : "Imóvel",
        });
        setContratarEscolhaOpen(false);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao iniciar contratação");
    }
  }

  function onContratarAgora() {
    if (!resultoDestacado) {
      scrollToResult();
      return;
    }
    setContratarEscolhaOpen(true);
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
        const text = encodeURIComponent(wa.mensagem_padrao ?? `Olá, simulei no site ${tenantBrand.nome}.`);
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

  const estrategiaLabel =
    percentualParcela < 100
      ? aplicarParcelaReduzidaPersonalizada
        ? `Parcela reduzida personalizada (${percentualParcela}% da parcela integral)`
        : opcaoSelecionada
          ? `${opcaoSelecionada.nome} (${percentualParcela}% da parcela integral)`
          : `${percentualParcela}% da parcela integral`
      : "Parcela integral";

  const footerCta =
    resultoDestacado ? (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 p-3 backdrop-blur sm:hidden">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="gold"
            className="min-h-11 flex-1"
            disabled={contratacaoLoading}
            onClick={onContratarAgora}
          >
            Contratar agora
          </Button>
          <Button type="button" variant="outlineGold" className="min-h-11 flex-1 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => openCaptura("especialista")}>
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
              onChange={(v) => setValorCredito(clampValorCreditoTipo(tipoBem, v, configs))}
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
                percentualReduzidaOverride={percentualReduzidaOverride}
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
              aplicarParcelaReduzidaPersonalizada={aplicarParcelaReduzidaPersonalizada}
              onAplicarParcelaReduzidaPersonalizada={(v) => {
                setAplicarParcelaReduzidaPersonalizada(v);
                if (v) {
                  const reduzida = opcoesParcela.find((o) => o.percentual < 100);
                  if (reduzida) setOpcaoParcelaId(reduzida.id);
                }
              }}
              percentualParcelaPersonalizada={percentualParcelaPersonalizada}
              onPercentualParcelaPersonalizada={setPercentualParcelaPersonalizada}
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
              disabled={contratacaoLoading}
              onClick={onContratarAgora}
            >
              Contratar agora
            </Button>
            <Button
              type="button"
              variant="outlineGold"
              className="min-h-12 flex-1 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 sm:min-w-[12rem]"
              onClick={() => openCaptura("proposta")}
            >
              Gerar proposta PDF
            </Button>
            <Button
              type="button"
              variant="outlineGold"
              className="min-h-12 flex-1 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 sm:min-w-[12rem]"
              onClick={() => openCaptura("analise")}
            >
              Ver análise completa
            </Button>
            <Button
              type="button"
              variant="outlineGold"
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

      {contratarEscolhaOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-white">Contratar agora</h2>
            <p className="text-sm text-slate-400">
              {isConsultor
                ? "Escolha como deseja prosseguir com esta simulação."
                : "Selecione o consultor responsável para continuar."}
            </p>
            {!isConsultor ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Consultor responsável *
                </label>
                <select
                  value={consultorId}
                  onChange={(e) => setConsultorId(e.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
                  required
                >
                  <option value="">Selecione…</option>
                  {consultores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button
              type="button"
              variant="gold"
              className="w-full"
              disabled={contratacaoLoading || (!isConsultor && !consultorId)}
              onClick={() => void executarContratacao("cliente_site")}
            >
              {isConsultor ? "Continuar como cliente" : "Continuar"}
            </Button>
            {isConsultor ? (
              <Button
                type="button"
                variant="outlineGold"
                className="w-full border-slate-600 bg-slate-950"
                disabled={contratacaoLoading}
                onClick={() => void executarContratacao("sdr_link")}
              >
                Gerar link para enviar ao cliente
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="w-full" onClick={() => setContratarEscolhaOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <PropostaLinkModal
        open={Boolean(linkModal)}
        onClose={() => setLinkModal(null)}
        protocolo={linkModal?.protocolo ?? ""}
        url={linkModal?.url ?? ""}
        credito={linkModal?.credito}
        parcela={linkModal?.parcela}
        tipoBem={linkModal?.tipoBem}
      />
    </SimuladorPageShell>
  );
}
