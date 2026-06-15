"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SimuladorTipoBemConfig } from "@/lib/config/defaults";
import { calcularParcelaConsorcio, type EntradaConsorcio } from "@/lib/simulador/consorcio";
import { simularFinanciamento } from "@/lib/simulador/financiamento";
import { compararConsorcioFinanciamento } from "@/lib/simulador/comparativo";
import { gerarProjecaoAnoAno } from "@/lib/simulador/projecao";
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
import { ProjectionSection } from "./projection-section";
import { LeadCaptureModal } from "./lead-capture-modal";
import type {
  AcaoCaptura,
  EstrategiaPagamento,
  Modo,
  SimuladorConfigs,
  TipoBem,
} from "./simulador-types";

export type { SimuladorConfigs } from "./simulador-types";
export { AVISO_PROJECAO } from "./simulador-types";

const PRAZOS_FIN = [60, 84, 120, 180, 240, 300, 360];

function prazosFinanciamento(prazoPadrao: number, prazoMaximo: number) {
  const list = PRAZOS_FIN.filter((p) => p <= prazoMaximo);
  if (!list.includes(prazoPadrao)) list.push(prazoPadrao);
  return [...new Set(list)].sort((a, b) => a - b);
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
  };
}

function parcelaConsorcioParaPrazo(
  base: Omit<EntradaConsorcio, "prazoMeses">,
  prazoMeses: number,
  estrategia: EstrategiaPagamento,
  bemCfg: SimuladorTipoBemConfig,
) {
  const r = calcularParcelaConsorcio({ ...base, prazoMeses });
  const integral = r.parcelaEstimada;
  if (estrategia === "reduzida" && bemCfg.temParcelaReduzida) {
    const pct = bemCfg.percentualParcelaReduzida ?? 50;
    return integral * (pct / 100);
  }
  return integral;
}

export function SimuladorApp({ configs }: { configs: SimuladorConfigs }) {
  const resultRef = useRef<HTMLDivElement>(null);

  const [modo, setModo] = useState<Modo>("consorcio");
  const [tipoBem, setTipoBem] = useState<TipoBem>("imovel");
  const [avancado, setAvancado] = useState(false);
  const [estrategia, setEstrategia] = useState<EstrategiaPagamento>("integral");
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
  const finCfg = configs.financiamento;

  const [valorCredito, setValorCredito] = useState(bemCfg.valorPadraoInicial);
  const [prazo, setPrazo] = useState(bemCfg.prazoPadrao);
  const [taxaAdm, setTaxaAdm] = useState(bemCfg.taxaAdministrativaPadrao);
  const [fundoReserva, setFundoReserva] = useState(bemCfg.fundoReservaPadrao);
  const [seguro, setSeguro] = useState(bemCfg.seguroPrestamistaPadrao);
  const [reajusteCredito, setReajusteCredito] = useState(bemCfg.reajusteAnualCredito);
  const [correcaoParcela, setCorrecaoParcela] = useState(bemCfg.correcaoAnualParcela);
  const [lanceProprio, setLanceProprio] = useState(0);
  const [lanceEmbutido, setLanceEmbutido] = useState(0);

  const [valorBem, setValorBem] = useState(500_000);
  const [entradaFin, setEntradaFin] = useState(100_000);
  const [taxaMensal, setTaxaMensal] = useState(finCfg.taxaMensalPadrao);
  const [prazoFin, setPrazoFin] = useState(finCfg.prazoPadrao);

  const lanceTotal = lanceProprio + lanceEmbutido;
  const creditoLiquido = Math.max(0, valorCredito - lanceEmbutido);

  const prazosConsorcio = useMemo(() => {
    const list = bemCfg.prazosDisponiveis?.length
      ? bemCfg.prazosDisponiveis
      : [bemCfg.prazoPadrao];
    return list.slice(0, bemCfg.quantidadePrazosExibidos ?? list.length);
  }, [bemCfg]);

  const prazosFin = useMemo(
    () => prazosFinanciamento(finCfg.prazoPadrao, finCfg.prazoMaximo),
    [finCfg],
  );

  const entradaConsorcio = useMemo(
    () =>
      buildEntradaConsorcio(
        valorCredito,
        prazo,
        taxaAdm,
        fundoReserva,
        seguro,
        lanceProprio,
        lanceEmbutido,
        reajusteCredito,
        correcaoParcela,
      ),
    [
      valorCredito,
      prazo,
      taxaAdm,
      fundoReserva,
      seguro,
      lanceProprio,
      lanceEmbutido,
      reajusteCredito,
      correcaoParcela,
    ],
  );

  const baseConsorcioSemPrazo = useMemo(
    () => ({
      valorCredito,
      taxaAdministrativaPercentual: taxaAdm,
      fundoReservaPercentual: fundoReserva,
      seguroPrestamistaPercentual: seguro,
      entrada: lanceProprio,
      lanceEmbutido,
      reajusteAnualCredito: reajusteCredito,
      correcaoAnualParcela: correcaoParcela,
    }),
    [
      valorCredito,
      taxaAdm,
      fundoReserva,
      seguro,
      lanceProprio,
      lanceEmbutido,
      reajusteCredito,
      correcaoParcela,
    ],
  );

  const resultadoConsorcio = useMemo(
    () => calcularParcelaConsorcio(entradaConsorcio),
    [entradaConsorcio],
  );

  const parcelaIntegral = resultadoConsorcio.parcelaEstimada;
  const pctReduzida = bemCfg.percentualParcelaReduzida ?? 50;
  const parcelaReduzida = parcelaIntegral * (pctReduzida / 100);
  const parcelaExibidaConsorcio =
    estrategia === "reduzida" && bemCfg.temParcelaReduzida ? parcelaReduzida : parcelaIntegral;

  const resultadoFin = useMemo(
    () =>
      simularFinanciamento({
        valorBem,
        entrada: entradaFin,
        taxaMensalPercentual: taxaMensal,
        prazoMeses: prazoFin,
      }),
    [valorBem, entradaFin, taxaMensal, prazoFin],
  );

  const comparativo = useMemo(() => {
    const entradaFinCmp = {
      valorBem: modo === "consorcio" ? valorCredito : valorBem,
      entrada: modo === "consorcio" ? lanceProprio : entradaFin,
      taxaMensalPercentual: taxaMensal,
      prazoMeses: modo === "consorcio" ? prazo : prazoFin,
    };
    return compararConsorcioFinanciamento(entradaConsorcio, entradaFinCmp);
  }, [
    modo,
    entradaConsorcio,
    valorCredito,
    valorBem,
    lanceProprio,
    entradaFin,
    taxaMensal,
    prazo,
    prazoFin,
  ]);

  const projecao = useMemo(() => {
    if (modo !== "consorcio" || !bemCfg.mostrarTabelaAnoAno) return [];
    return gerarProjecaoAnoAno(entradaConsorcio);
  }, [modo, entradaConsorcio, bemCfg.mostrarTabelaAnoAno]);

  const resumoAno1 = projecao[0];

  const parcelaForPrazoConsorcio = useCallback(
    (meses: number) =>
      parcelaConsorcioParaPrazo(baseConsorcioSemPrazo, meses, estrategia, bemCfg),
    [baseConsorcioSemPrazo, estrategia, bemCfg],
  );

  const parcelaForPrazoFin = useCallback(
    (meses: number) =>
      simularFinanciamento({
        valorBem,
        entrada: entradaFin,
        taxaMensalPercentual: taxaMensal,
        prazoMeses: meses,
      }).parcelaEstimada,
    [valorBem, entradaFin, taxaMensal],
  );

  function aplicarDefaultsBem(b: TipoBem) {
    if (b !== "imovel" && b !== "automovel") return;
    const c = b === "imovel" ? configs.imovel : configs.automovel;
    setValorCredito(c.valorPadraoInicial);
    setPrazo(c.prazoPadrao);
    setTaxaAdm(c.taxaAdministrativaPadrao);
    setFundoReserva(c.fundoReservaPadrao);
    setSeguro(c.seguroPrestamistaPadrao);
    setReajusteCredito(c.reajusteAnualCredito);
    setCorrecaoParcela(c.correcaoAnualParcela);
    setLanceProprio(0);
    setLanceEmbutido(0);
    if (!c.temParcelaReduzida) setEstrategia("integral");
  }

  function handleModoChange(m: Modo) {
    setModo(m);
    setResultoDestacado(false);
    setMsg(null);
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
              ...resultadoConsorcio,
              parcelaExibida: parcelaExibidaConsorcio,
              estrategia,
              lanceTotal,
              creditoLiquido,
              comparativo,
            }
          : { ...resultadoFin, comparativo };
      const res = await fetch("/api/public/simulador/captura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp,
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

  const mostrarComparativo =
    (modo === "consorcio" && bemCfg.mostrarComparacaoFinanciamento) ||
    (modo === "financiamento" && finCfg.mostrarComparacaoConsorcio);

  const estrategiaLabel =
    estrategia === "reduzida" && bemCfg.temParcelaReduzida
      ? `Parcela reduzida (${pctReduzida}% até contemplação)`
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
            className="min-h-11 flex-1 border-slate-600"
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
            <PaymentStrategyStep
              estrategia={estrategia}
              onChange={setEstrategia}
              mostrarReduzida={!!bemCfg.temParcelaReduzida}
              percentualReduzida={pctReduzida}
              parcelaIntegral={parcelaIntegral}
              parcelaReduzida={parcelaReduzida}
            />
            <AdvancedStrategyAccordion
              open={avancado}
              onToggle={() => setAvancado((v) => !v)}
              lanceProprio={lanceProprio}
              onLanceProprio={setLanceProprio}
              lanceEmbutido={lanceEmbutido}
              onLanceEmbutido={setLanceEmbutido}
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
              maxLanceEmbutido={valorCredito}
            />
          </>
        ) : (
          <>
            <CreditValueStep
              title="1. Valor do bem"
              valueLabel="Valor do bem"
              value={valorBem}
              min={30_000}
              max={3_000_000}
              onChange={setValorBem}
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
            <ConsorcioResultCards
              resultado={resultadoConsorcio}
              parcelaExibida={parcelaExibidaConsorcio}
              lanceTotal={lanceTotal}
              creditoLiquido={creditoLiquido}
              estrategiaLabel={estrategiaLabel}
            />
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

          {mostrarComparativo ? <ComparisonSection modo={modo} comparativo={comparativo} /> : null}

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
              className="min-h-12 flex-1 border-slate-600 text-base sm:min-w-[12rem]"
              onClick={() => openCaptura("analise")}
            >
              Ver análise completa
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 flex-1 border-slate-600 text-base sm:min-w-[12rem]"
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
