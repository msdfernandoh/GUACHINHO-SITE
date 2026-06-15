"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Scale } from "lucide-react";
import type {
  FinanciamentoConfig,
  SimuladorTipoBemConfig,
} from "@/lib/config/defaults";
import { calcularParcelaConsorcio, type EntradaConsorcio } from "@/lib/simulador/consorcio";
import { simularFinanciamento } from "@/lib/simulador/financiamento";
import { compararConsorcioFinanciamento } from "@/lib/simulador/comparativo";
import { gerarProjecaoAnoAno } from "@/lib/simulador/projecao";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button, Input, Label } from "@/components/ui/form-primitives";

export const AVISO_PROJECAO =
  "Projeção estimada com base nos índices configurados. Os valores podem variar conforme administradora, grupo, índice de reajuste, regras contratuais e data de contemplação. Esta simulação não representa garantia de rentabilidade, contemplação ou disponibilidade.";

export type SimuladorConfigs = {
  imovel: SimuladorTipoBemConfig;
  automovel: SimuladorTipoBemConfig;
  financiamento: FinanciamentoConfig;
};

type Modo = "consorcio" | "financiamento";
type TipoBem = "imovel" | "automovel";
type AcaoCaptura = "analise" | "proposta" | "especialista";

export function SimuladorApp({ configs }: { configs: SimuladorConfigs }) {
  const [modo, setModo] = useState<Modo>("consorcio");
  const [tipoBem, setTipoBem] = useState<TipoBem>("imovel");
  const [avancado, setAvancado] = useState(false);
  const [simulado, setSimulado] = useState(false);
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const [capturaOpen, setCapturaOpen] = useState(false);
  const [capturaAcao, setCapturaAcao] = useState<AcaoCaptura>("analise");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cidade, setCidade] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);

  const bemCfg = tipoBem === "imovel" ? configs.imovel : configs.automovel;
  const finCfg = configs.financiamento;

  const [valorCredito, setValorCredito] = useState(bemCfg.valorPadraoInicial);
  const [prazo, setPrazo] = useState(bemCfg.prazoPadrao);
  const [taxaAdm, setTaxaAdm] = useState(bemCfg.taxaAdministrativaPadrao);
  const [fundoReserva, setFundoReserva] = useState(bemCfg.fundoReservaPadrao);
  const [seguro, setSeguro] = useState(bemCfg.seguroPrestamistaPadrao);
  const [reajusteCredito, setReajusteCredito] = useState(bemCfg.reajusteAnualCredito);
  const [correcaoParcela, setCorrecaoParcela] = useState(bemCfg.correcaoAnualParcela);
  const [entrada, setEntrada] = useState(0);
  const [lanceEmbutido, setLanceEmbutido] = useState(0);

  const [valorBem, setValorBem] = useState(500_000);
  const [entradaFin, setEntradaFin] = useState(100_000);
  const [taxaMensal, setTaxaMensal] = useState(finCfg.taxaMensalPadrao);
  const [prazoFin, setPrazoFin] = useState(finCfg.prazoPadrao);

  const prazosExibidos = useMemo(() => {
    const list = bemCfg.prazosDisponiveis?.length
      ? bemCfg.prazosDisponiveis
      : [bemCfg.prazoPadrao];
    return list.slice(0, bemCfg.quantidadePrazosExibidos ?? list.length);
  }, [bemCfg]);

  const entradaConsorcio: EntradaConsorcio = useMemo(
    () => ({
      valorCredito,
      prazoMeses: prazo,
      taxaAdministrativaPercentual: taxaAdm,
      fundoReservaPercentual: fundoReserva,
      seguroPrestamistaPercentual: seguro,
      entrada,
      lanceEmbutido,
      reajusteAnualCredito: reajusteCredito,
      correcaoAnualParcela: correcaoParcela,
    }),
    [
      valorCredito,
      prazo,
      taxaAdm,
      fundoReserva,
      seguro,
      entrada,
      lanceEmbutido,
      reajusteCredito,
      correcaoParcela,
    ],
  );

  const resultadoConsorcio = useMemo(
    () => (simulado && modo === "consorcio" ? calcularParcelaConsorcio(entradaConsorcio) : null),
    [simulado, modo, entradaConsorcio],
  );

  const resultadoFin = useMemo(
    () =>
      simulado && modo === "financiamento"
        ? simularFinanciamento({
            valorBem,
            entrada: entradaFin,
            taxaMensalPercentual: taxaMensal,
            prazoMeses: prazoFin,
          })
        : null,
    [simulado, modo, valorBem, entradaFin, taxaMensal, prazoFin],
  );

  const comparativo = useMemo(() => {
    if (!simulado) return null;
    const entradaFinCmp = {
      valorBem: modo === "consorcio" ? valorCredito : valorBem,
      entrada: modo === "consorcio" ? entrada : entradaFin,
      taxaMensalPercentual: taxaMensal,
      prazoMeses: modo === "consorcio" ? prazo : prazoFin,
    };
    return compararConsorcioFinanciamento(entradaConsorcio, entradaFinCmp);
  }, [
    simulado,
    modo,
    entradaConsorcio,
    valorCredito,
    valorBem,
    entrada,
    entradaFin,
    taxaMensal,
    prazo,
    prazoFin,
  ]);

  const projecao = useMemo(() => {
    if (!simulado || modo !== "consorcio" || !bemCfg.mostrarTabelaAnoAno) return [];
    return gerarProjecaoAnoAno(entradaConsorcio);
  }, [simulado, modo, entradaConsorcio, bemCfg.mostrarTabelaAnoAno]);

  const resumoAno1 = projecao[0];

  function aplicarDefaultsBem(b: TipoBem) {
    const c = b === "imovel" ? configs.imovel : configs.automovel;
    setValorCredito(c.valorPadraoInicial);
    setPrazo(c.prazoPadrao);
    setTaxaAdm(c.taxaAdministrativaPadrao);
    setFundoReserva(c.fundoReservaPadrao);
    setSeguro(c.seguroPrestamistaPadrao);
    setReajusteCredito(c.reajusteAnualCredito);
    setCorrecaoParcela(c.correcaoAnualParcela);
  }

  function handleSimular() {
    setSimulado(true);
    setTabelaAberta(bemCfg.exibirTabelaCompletaPorPadrao ?? false);
    setMsg(null);
    setWaLink(null);
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
      const resultado =
        modo === "consorcio"
          ? { ...resultadoConsorcio, comparativo }
          : { ...resultadoFin, comparativo };
      const res = await fetch("/api/public/simulador/captura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp,
          cidade,
          modo,
          tipoBem: modo === "consorcio" ? tipoBem : undefined,
          acao: capturaAcao,
          entrada:
            modo === "consorcio"
              ? entradaConsorcio
              : { valorBem, entrada: entradaFin, taxaMensalPercentual: taxaMensal, prazoMeses: prazoFin },
          resultado,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha");
      setCapturaOpen(false);
      setMsg(
        capturaAcao === "proposta"
          ? "Proposta básica criada. Nossa equipe dará sequência."
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
    simulado &&
    comparativo &&
    ((modo === "consorcio" && bemCfg.mostrarComparacaoFinanciamento) ||
      (modo === "financiamento" && finCfg.mostrarComparacaoConsorcio));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-500">
            Simulador Gauchinho
          </p>
          <h1 className="mt-2 text-4xl font-bold text-white">Planeje seu consórcio ou financiamento</h1>
          <p className="mt-2 text-zinc-400">Resultado imediato — cadastro só para análise completa ou proposta.</p>
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {(["consorcio", "financiamento"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setModo(m);
                setSimulado(false);
              }}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium capitalize",
                modo === m ? "bg-amber-500 text-zinc-950" : "border border-zinc-700 text-zinc-300",
              )}
            >
              {m === "consorcio" ? "Consórcio" : "Financiamento"}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          {modo === "consorcio" ? (
            <>
              <div className="mb-4 flex gap-2">
                {(["imovel", "automovel"] as TipoBem[]).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setTipoBem(b);
                      aplicarDefaultsBem(b);
                      setSimulado(false);
                    }}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm capitalize",
                      tipoBem === b ? "bg-zinc-800 text-amber-400" : "text-zinc-400",
                    )}
                  >
                    {b === "imovel" ? "Imóvel" : "Automóvel"}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Valor do crédito: {formatCurrency(valorCredito)}</Label>
                  <input
                    type="range"
                    min={bemCfg.valorMinimoCredito}
                    max={bemCfg.valorMaximoCredito}
                    step={1000}
                    value={valorCredito}
                    onChange={(e) => setValorCredito(Number(e.target.value))}
                    className="mt-2 w-full accent-amber-500"
                  />
                </div>
                <div>
                  <Label>Prazo: {prazo} meses</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {prazosExibidos.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPrazo(p)}
                        className={cn(
                          "rounded-lg px-3 py-1 text-sm",
                          prazo === p ? "bg-amber-500 text-zinc-950" : "bg-zinc-800",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-sm text-amber-400 underline"
                  onClick={() => setAvancado((v) => !v)}
                >
                  {avancado ? "− Ocultar opções avançadas" : "+ Opções avançadas"}
                </button>
                {avancado ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input type="number" placeholder="Entrada / recurso próprio" value={entrada || ""} onChange={(e) => setEntrada(Number(e.target.value))} className="bg-zinc-950" />
                    <Input type="number" placeholder="Lance embutido" value={lanceEmbutido || ""} onChange={(e) => setLanceEmbutido(Number(e.target.value))} className="bg-zinc-950" />
                    <Input type="number" placeholder="Taxa adm %" value={taxaAdm} onChange={(e) => setTaxaAdm(Number(e.target.value))} className="bg-zinc-950" />
                    <Input type="number" placeholder="Fundo reserva %" value={fundoReserva} onChange={(e) => setFundoReserva(Number(e.target.value))} className="bg-zinc-950" />
                    <Input type="number" placeholder="Seguro % a.a." value={seguro} onChange={(e) => setSeguro(Number(e.target.value))} className="bg-zinc-950" />
                    <Input type="number" placeholder="Reajuste crédito % a.a." value={reajusteCredito} onChange={(e) => setReajusteCredito(Number(e.target.value))} className="bg-zinc-950" />
                    <Input type="number" placeholder="Correção parcela % a.a." value={correcaoParcela} onChange={(e) => setCorrecaoParcela(Number(e.target.value))} className="bg-zinc-950" />
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Valor do bem</Label>
                <Input type="number" value={valorBem} onChange={(e) => setValorBem(Number(e.target.value))} className="bg-zinc-950" />
              </div>
              <div>
                <Label>Entrada</Label>
                <Input type="number" value={entradaFin} onChange={(e) => setEntradaFin(Number(e.target.value))} className="bg-zinc-950" />
              </div>
              <div>
                <Label>Taxa mensal (%)</Label>
                <Input type="number" step="0.01" value={taxaMensal} onChange={(e) => setTaxaMensal(Number(e.target.value))} className="bg-zinc-950" />
              </div>
              <div>
                <Label>Prazo (meses)</Label>
                <Input type="number" value={prazoFin} onChange={(e) => setPrazoFin(Number(e.target.value))} className="bg-zinc-950" />
              </div>
            </div>
          )}

          <Button type="button" variant="gold" className="mt-6 w-full sm:w-auto" onClick={handleSimular}>
            Simular
          </Button>
        </div>

        {simulado && modo === "consorcio" && resultadoConsorcio ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6">
              <p className="text-sm text-zinc-500">Parcela estimada</p>
              <p className="text-4xl font-bold text-amber-400">{formatCurrency(resultadoConsorcio.parcelaEstimada)}</p>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <p>Crédito: {formatCurrency(resultadoConsorcio.valorCredito)}</p>
                <p>Prazo: {resultadoConsorcio.prazoMeses} meses</p>
                <p>Taxa adm total: {formatCurrency(resultadoConsorcio.taxaAdministrativaTotal)}</p>
                <p>Fundo reserva: {formatCurrency(resultadoConsorcio.fundoReservaTotal)}</p>
                <p>Seguro (est.): {formatCurrency(resultadoConsorcio.seguroTotalEstimado)}</p>
                <p>Total estimado: {formatCurrency(resultadoConsorcio.valorTotalEstimado)}</p>
              </div>
            </div>

            {resumoAno1 ? (
              <div className="rounded-xl border border-zinc-800 p-5">
                <h3 className="font-semibold text-amber-400">Vantagem da Programação Financeira</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
                  <div className="rounded-lg bg-zinc-900 p-3">
                    <p className="text-zinc-500">Total pago em 1 ano</p>
                    <p className="text-lg font-semibold">{formatCurrency(resumoAno1.totalPagoAcumulado)}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-900 p-3">
                    <p className="text-zinc-500">Crédito estimado em 1 ano</p>
                    <p className="text-lg font-semibold">{formatCurrency(resumoAno1.creditoEstimadoReajustado)}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-900 p-3">
                    <p className="text-zinc-500">Ganho patrimonial est.</p>
                    <p className="text-lg font-semibold">{formatCurrency(resumoAno1.ganhoPatrimonialEstimado)}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">{AVISO_PROJECAO}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 border-zinc-600"
                  onClick={() => setTabelaAberta((v) => !v)}
                >
                  {tabelaAberta ? (
                    <>
                      <ChevronUp className="mr-1 h-4 w-4" /> Ocultar projeção completa
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-4 w-4" /> Ver projeção completa
                    </>
                  )}
                </Button>
                {tabelaAberta && projecao.length ? (
                  <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-zinc-800">
                    <table className="min-w-full text-xs">
                      <thead className="bg-zinc-900 text-left text-zinc-500">
                        <tr>
                          <th className="p-2">Ano</th>
                          <th className="p-2">Meses</th>
                          <th className="p-2">Total pago</th>
                          <th className="p-2">Crédito reaj.</th>
                          <th className="p-2">Ganho pat.</th>
                          <th className="p-2">Parcela</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projecao.map((l) => (
                          <tr key={l.ano} className="border-t border-zinc-800">
                            <td className="p-2">{l.ano}</td>
                            <td className="p-2">{l.mesesPagosAcumulados}</td>
                            <td className="p-2">{formatCurrency(l.totalPagoAcumulado)}</td>
                            <td className="p-2">{formatCurrency(l.creditoEstimadoReajustado)}</td>
                            <td className="p-2">{formatCurrency(l.ganhoPatrimonialEstimado)}</td>
                            <td className="p-2">{formatCurrency(l.parcelaEstimadaNoPeriodo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {simulado && modo === "financiamento" && resultadoFin ? (
          <div className="mt-8 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-6">
            <p className="text-sm text-zinc-500">Parcela estimada (prestação fixa)</p>
            <p className="text-4xl font-bold text-white">{formatCurrency(resultadoFin.parcelaEstimada)}</p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p>Valor financiado: {formatCurrency(resultadoFin.valorFinanciado)}</p>
              <p>Total pago: {formatCurrency(resultadoFin.valorTotalPago)}</p>
              <p>Juros totais: {formatCurrency(resultadoFin.jurosTotais)}</p>
              <p>Custo final: {formatCurrency(resultadoFin.custoFinal)}</p>
            </div>
          </div>
        ) : null}

        {mostrarComparativo && comparativo ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <Scale className="h-5 w-5 text-amber-400" /> Consórcio x Financiamento
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-emerald-950/40 p-4 border border-emerald-800/50">
                <p className="font-medium text-emerald-300">Consórcio</p>
                <ul className="mt-2 list-inside list-disc text-xs text-zinc-400">
                  <li>Sem juros</li>
                  <li>Compra planejada</li>
                  <li>Taxa administrativa</li>
                  <li>Possibilidade de lance</li>
                </ul>
                <p className="mt-3 text-lg font-semibold">{formatCurrency(comparativo.consorcio.parcelaEstimada)}/mês</p>
                <p className="text-sm text-zinc-500">Total est.: {formatCurrency(comparativo.consorcio.valorTotalEstimado)}</p>
              </div>
              <div className="rounded-xl bg-sky-950/40 p-4 border border-sky-800/50">
                <p className="font-medium text-sky-300">Financiamento</p>
                <ul className="mt-2 list-inside list-disc text-xs text-zinc-400">
                  <li>Compra imediata</li>
                  <li>Juros mensais</li>
                  <li>Análise de crédito</li>
                  <li>Custo final maior</li>
                </ul>
                <p className="mt-3 text-lg font-semibold">{formatCurrency(comparativo.financiamento.parcelaEstimada)}/mês</p>
                <p className="text-sm text-zinc-500">Total: {formatCurrency(comparativo.financiamento.custoFinal)}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-amber-200/90">
              Diferença estimada de custo total: {formatCurrency(comparativo.diferencaCustoTotal)} · Diferença de parcela:{" "}
              {formatCurrency(comparativo.diferencaParcela)}
            </p>
          </div>
        ) : null}

        {simulado ? (
          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" variant="gold" onClick={() => openCaptura("analise")}>
              Ver análise completa
            </Button>
            <Button type="button" variant="outline" className="border-zinc-600" onClick={() => openCaptura("proposta")}>
              Gerar proposta
            </Button>
            <Button type="button" variant="outline" className="border-zinc-600" onClick={() => openCaptura("especialista")}>
              Falar com especialista
            </Button>
          </div>
        ) : null}

        {msg ? <p className="mt-4 text-sm text-emerald-400">{msg}</p> : null}
        {waLink ? (
          <a href={waLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-amber-400 underline">
            Abrir WhatsApp
          </a>
        ) : null}

        <p className="mt-10 text-center text-sm text-zinc-500">
          <Link href="/grupos" className="text-amber-400 hover:underline">
            Ver grupos disponíveis
          </Link>
        </p>
      </div>

      {capturaOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={submitCaptura} className="w-full max-w-md space-y-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Seus dados</h2>
            <div>
              <Label>Nome</Label>
              <Input required value={nome} onChange={(e) => setNome(e.target.value)} className="bg-zinc-950" />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="bg-zinc-950" />
            </div>
            <div>
              <Label>Cidade (opcional)</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} className="bg-zinc-950" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="gold" disabled={loading}>
                {loading ? "Salvando…" : "Enviar"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCapturaOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
