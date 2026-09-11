"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BadgePercent,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Check,
  Clock,
  Coins,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  History,
  Layers,
  ListFilter,
  Lock,
  PieChart,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Unlock,
  User,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import type {
  ContaCorrenteResumoDTO,
  TipoFiltroPeriodo,
  ConferenciaMensalDTO,
  LancamentoConferenciaDTO,
  FechamentoGeralDTO,
  DespesaRateioDTO,
  ComissaoSocioDTO,
  MovimentoLedgerDTO,
  ReservaFuturaDTO,
  PrevisaoOrcamentoDTO,
  MetaSocioDTO,
  SocioDTO,
} from "@/app/erp/conta-corrente-socios/actions";
import {
  usarComissaoCompensarAction,
  salvarRateioDespesaAction,
  salvarReservaFuturaAction,
  liberarReservaAction,
  salvarPrevisaoOrcamentoAction,
  salvarMetasSociosAction,
  estornarMovimentoLedgerAction,
} from "@/app/erp/conta-corrente-socios/actions";

interface ContaCorrenteSociosViewProps {
  dados: ContaCorrenteResumoDTO;
  competencia: string;
  socioSelecionadoId?: string;
  tipoPeriodoInicial?: TipoFiltroPeriodo;
  dataInicioInicial?: string;
  dataFimInicial?: string;
}

const brl = (val: number) =>
  val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatPct = (val: number) =>
  `${Number(val || 0).toFixed(1).replace(".", ",")}%`;

const formatDataBr = (val: string) => {
  if (!val) return "-";
  const [ano, mes, dia] = val.split("-");
  return dia ? `${dia}/${mes}/${ano}` : `${mes}/${ano}`;
};

export function ContaCorrenteSociosView({
  dados,
  competencia,
  socioSelecionadoId,
  tipoPeriodoInicial,
  dataInicioInicial,
  dataFimInicial,
}: ContaCorrenteSociosViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estados principais de visualização
  const [modoVisualizacao, setModoVisualizacao] = useState<"resumida" | "detalhada">("resumida");
  const [abaAtiva, setAbaAtiva] = useState<
    "resumo" | "despesas" | "comissoes" | "ledger" | "previsao" | "fechamentos"
  >("resumo");

  // Estados de Controle do Seletor de Período e Drill-Down
  const [dropdownPeriodoAberto, setDropdownPeriodoAberto] = useState(false);
  const [modalPeriodoPersonalizadoAberto, setModalPeriodoPersonalizadoAberto] = useState(false);
  const [customDataInicio, setCustomDataInicio] = useState(dados.dataInicio || "");
  const [customDataFim, setCustomDataFim] = useState(dados.dataFim || "");
  const [mesDrillDownSelecionado, setMesDrillDownSelecionado] = useState<ConferenciaMensalDTO | null>(null);

  // Filtros internos
  const [filtroComissao, setFiltroComissao] = useState<
    "TODAS" | "GARANTIDA" | "PREVISTA" | "RECEBIDA" | "COMPENSADA"
  >("TODAS");
  const [filtroDespesaStatus, setFiltroDespesaStatus] = useState<"TODAS" | "aberta" | "paga">("TODAS");
  const [buscaDespesa, setBuscaDespesa] = useState("");
  const [buscaComissao, setBuscaComissao] = useState("");

  // Modais
  const [modalCompensarAberto, setModalCompensarAberto] = useState(false);
  const [comissaoParaCompensar, setComissaoParaCompensar] = useState<ComissaoSocioDTO | null>(null);

  const [modalRateioAberto, setModalRateioAberto] = useState(false);
  const [despesaParaRateio, setDespesaParaRateio] = useState<DespesaRateioDTO | null>(null);

  const [modalReservaAberto, setModalReservaAberto] = useState(false);
  const [modalMetasAberto, setModalMetasAberto] = useState(false);
  const [metaSocioEdicao, setMetaSocioEdicao] = useState<MetaSocioDTO | null>(null);

  const [modalEstornoAberto, setModalEstornoAberto] = useState(false);
  const [movimentoParaEstorno, setMovimentoParaEstorno] = useState<MovimentoLedgerDTO | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");

  // Mensagens de Feedback
  const [mensagemFeedback, setMensagemFeedback] = useState<{
    tipo: "sucesso" | "erro";
    texto: string;
  } | null>(null);

  const socioAtivo = dados.socioSelecionado;
  const isVisaoTodos = !socioAtivo;

  // Filtragem de Despesas
  const despesasFiltradas = useMemo(() => {
    return dados.despesasRateadas.filter((d) => {
      if (filtroDespesaStatus !== "TODAS" && d.status !== filtroDespesaStatus) return false;
      if (buscaDespesa) {
        const termo = buscaDespesa.toLowerCase();
        const matchDesc = d.descricao.toLowerCase().includes(termo);
        const matchCat = d.categoria.toLowerCase().includes(termo);
        const matchPagador = (d.pagoPorSocioNome || "").toLowerCase().includes(termo);
        if (!matchDesc && !matchCat && !matchPagador) return false;
      }
      return true;
    });
  }, [dados.despesasRateadas, filtroDespesaStatus, buscaDespesa]);

  // Filtragem de Comissões
  const comissoesFiltradas = useMemo(() => {
    return dados.comissoesSocio.filter((c) => {
      if (filtroComissao !== "TODAS" && c.tipoClassificacao !== filtroComissao) return false;
      if (buscaComissao) {
        const termo = buscaComissao.toLowerCase();
        const matchCli = (c.clienteNome || "").toLowerCase().includes(termo);
        const matchCota = (c.cotaInfo || "").toLowerCase().includes(termo);
        const matchEtapa = c.etapaNome.toLowerCase().includes(termo);
        if (!matchCli && !matchCota && !matchEtapa) return false;
      }
      return true;
    });
  }, [dados.comissoesSocio, filtroComissao, buscaComissao]);

  // Handler de navegação de competência, tipo de período e sócio
  function alterarFiltros(params: {
    tipoPeriodo?: TipoFiltroPeriodo;
    mes?: string;
    de?: string;
    ate?: string;
    socioId?: string;
  }) {
    const sp = new URLSearchParams();
    const tp = params.tipoPeriodo !== undefined ? params.tipoPeriodo : dados.tipoPeriodo;
    const mes = params.mes !== undefined ? params.mes : dados.competencia;
    const de = params.de !== undefined ? params.de : dados.dataInicio;
    const ate = params.ate !== undefined ? params.ate : dados.dataFim;
    const socio = params.socioId !== undefined ? params.socioId : socioSelecionadoId || "todos";

    if (tp && tp !== "mes") sp.set("tipo_periodo", tp);
    if (mes && tp === "mes") sp.set("mes", mes);
    if (de && tp === "personalizado") sp.set("de", de);
    if (ate && tp === "personalizado") sp.set("ate", ate);
    if (socio && socio !== "todos") sp.set("socio", socio);

    router.push(`/erp/conta-corrente-socios?${sp.toString()}`);
  }

  // Compatibilidade legada para chamadas com argumentos posicionais
  function alterarFiltrosLegado(novoMes?: string, novoSocioId?: string) {
    alterarFiltros({ mes: novoMes, socioId: novoSocioId, tipoPeriodo: novoMes ? "mes" : undefined });
  }

  // Ação: Submeter Compensação
  async function handleCompensar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await usarComissaoCompensarAction(form);
        setModalCompensarAberto(false);
        setComissaoParaCompensar(null);
        setMensagemFeedback({
          tipo: "sucesso",
          texto: "Compensação de comissão realizada com sucesso! Despesa amortizada e lançamento registrado no ledger.",
        });
        router.refresh();
      } catch (err: any) {
        setMensagemFeedback({ tipo: "erro", texto: err.message || "Erro ao realizar compensação." });
      }
    });
  }

  // Ação: Submeter Rateio
  async function handleSalvarRateio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await salvarRateioDespesaAction(form);
        setModalRateioAberto(false);
        setDespesaParaRateio(null);
        setMensagemFeedback({
          tipo: "sucesso",
          texto: "Configuração de rateio atualizada com sucesso para esta despesa.",
        });
        router.refresh();
      } catch (err: any) {
        setMensagemFeedback({ tipo: "erro", texto: err.message || "Erro ao salvar rateio." });
      }
    });
  }

  // Ação: Submeter Reserva
  async function handleSalvarReserva(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await salvarReservaFuturaAction(form);
        setModalReservaAberto(false);
        setMensagemFeedback({
          tipo: "sucesso",
          texto: "Reserva de caixa cadastrada com sucesso.",
        });
        router.refresh();
      } catch (err: any) {
        setMensagemFeedback({ tipo: "erro", texto: err.message || "Erro ao cadastrar reserva." });
      }
    });
  }

  // Ação: Liberar Reserva
  function handleLiberarReserva(id: string) {
    if (!confirm("Deseja realmente liberar esta reserva para o saldo disponível do sócio?")) return;
    startTransition(async () => {
      try {
        await liberarReservaAction(id);
        setMensagemFeedback({
          tipo: "sucesso",
          texto: "Reserva liberada! O valor agora compõe o saldo disponível para saque.",
        });
        router.refresh();
      } catch (err: any) {
        setMensagemFeedback({ tipo: "erro", texto: err.message || "Erro ao liberar reserva." });
      }
    });
  }

  // Ação: Submeter Metas
  async function handleSalvarMetas(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await salvarMetasSociosAction(form);
        setModalMetasAberto(false);
        setMensagemFeedback({
          tipo: "sucesso",
          texto: "Meta de vendas do sócio atualizada com sucesso.",
        });
        router.refresh();
      } catch (err: any) {
        setMensagemFeedback({ tipo: "erro", texto: err.message || "Erro ao salvar metas." });
      }
    });
  }

  // Ação: Estornar Movimento Ledger
  async function handleEstornarLedger() {
    if (!movimentoParaEstorno || !motivoEstorno.trim()) return;
    startTransition(async () => {
      try {
        await estornarMovimentoLedgerAction(movimentoParaEstorno.id, motivoEstorno);
        setModalEstornoAberto(false);
        setMovimentoParaEstorno(null);
        setMotivoEstorno("");
        setMensagemFeedback({
          tipo: "sucesso",
          texto: "Movimento estornado com sucesso através de lançamento compensatório auditado.",
        });
        router.refresh();
      } catch (err: any) {
        setMensagemFeedback({ tipo: "erro", texto: err.message || "Erro ao realizar estorno." });
      }
    });
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Feedback Toast */}
      {mensagemFeedback && (
        <div
          className={`flex items-center justify-between rounded-2xl p-4 shadow-md transition-all ${
            mensagemFeedback.tipo === "sucesso"
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-900"
              : "bg-rose-500/15 border border-rose-500/30 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-3">
            {mensagemFeedback.tipo === "sucesso" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-semibold">{mensagemFeedback.texto}</p>
          </div>
          <button
            onClick={() => setMensagemFeedback(null)}
            className="rounded-lg p-1 hover:bg-black/5 text-slate-500 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300">
                <Scale className="h-3.5 w-3.5" /> Financeiro dos Sócios
              </span>
              <span className="text-xs text-slate-400 font-medium">ERP Gauchinho</span>
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
              Conta-Corrente dos Sócios
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-300 max-w-2xl">
              Comissões, equalização de rateios, despesas pagas do próprio bolso, reservas e saldo disponível para saque.
            </p>
          </div>

          {/* Seletor de Modo: RESUMIDA vs DETALHADA */}
          <div className="flex items-center gap-1 rounded-2xl bg-white/10 p-1.5 backdrop-blur-md">
            <button
              onClick={() => setModoVisualizacao("resumida")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
                modoVisualizacao === "resumida"
                  ? "bg-white text-slate-950 shadow-md scale-[1.02]"
                  : "text-white/80 hover:text-white hover:bg-white/5"
              }`}
            >
              <Eye className="h-4 w-4" />
              Visão Resumida
            </button>
            <button
              onClick={() => setModoVisualizacao("detalhada")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
                modoVisualizacao === "detalhada"
                  ? "bg-white text-slate-950 shadow-md scale-[1.02]"
                  : "text-white/80 hover:text-white hover:bg-white/5"
              }`}
            >
              <ListFilter className="h-4 w-4" />
              Visão Detalhada
            </button>
          </div>
        </div>

        {/* BARRA DE CONTROLE: MÊS + SELETOR DE SÓCIO + AÇÕES RÁPIDAS */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* SELETOR DE PERÍODO MULTIFUNCIONAL */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownPeriodoAberto(!dropdownPeriodoAberto)}
                className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-black text-white transition-all shadow-sm active:scale-95 border border-white/10"
              >
                <Calendar className="h-4 w-4 text-amber-300" />
                <span>{dados.rotuloPeriodo}</span>
                <ChevronDown className="h-3.5 w-3.5 text-white/70" />
              </button>

              {dropdownPeriodoAberto && (
                <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Filtrar por Período
                    </span>
                    <button
                      type="button"
                      onClick={() => setDropdownPeriodoAberto(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-0.5 py-1">
                    {[
                      { id: "mes_atual", label: "Mês atual" },
                      { id: "mes_anterior", label: "Mês anterior" },
                      { id: "ultimos_3_meses", label: "Últimos 3 meses" },
                      { id: "ultimos_6_meses", label: "Últimos 6 meses" },
                      { id: "ano_atual", label: "Ano atual" },
                      { id: "todos_periodos", label: "Todos os períodos" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setDropdownPeriodoAberto(false);
                          alterarFiltros({ tipoPeriodo: opt.id as any });
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-between ${
                          dados.tipoPeriodo === opt.id
                            ? "bg-amber-100 text-amber-950 font-black"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {dados.tipoPeriodo === opt.id && <Check className="h-3.5 w-3.5 text-amber-600" />}
                      </button>
                    ))}
                  </div>

                  {/* Mês específico */}
                  <div className="p-2 border-t border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Mês Específico
                    </span>
                    <input
                      type="month"
                      defaultValue={dados.competencia}
                      onChange={(e) => {
                        if (e.target.value) {
                          setDropdownPeriodoAberto(false);
                          alterarFiltros({ tipoPeriodo: "mes", mes: e.target.value });
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  {/* Período personalizado */}
                  <div className="p-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownPeriodoAberto(false);
                        setModalPeriodoPersonalizadoAberto(true);
                      }}
                      className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-black text-slate-800 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      Período personalizado (De/Até)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Seletor de Sócio */}
            <div className="flex items-center gap-1.5 rounded-xl bg-white/10 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => alterarFiltros({ socioId: "todos" })}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  isVisaoTodos
                    ? "bg-amber-400 text-slate-950 font-black shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Todos os Sócios
              </button>
              {dados.todosSocios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => alterarFiltros({ socioId: s.id })}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                    socioAtivo?.id === s.id
                      ? "bg-amber-400 text-slate-950 font-black shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  {s.nome} ({s.percentualParticipacao}%)
                </button>
              ))}
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setComissaoParaCompensar(null);
                setModalCompensarAberto(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 text-xs font-black shadow-lg transition-all active:scale-95"
            >
              <Zap className="h-3.5 w-3.5" />
              Usar Comissão p/ Compensar
            </button>

            <button
              onClick={() => setModalReservaAberto(true)}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white px-3 py-2 text-xs font-bold transition-all"
            >
              <Lock className="h-3.5 w-3.5 text-amber-300" />
              Nova Reserva
            </button>

            <button
              onClick={() => {
                const meta = dados.metasSocios.find((m) => m.socioId === socioAtivo?.id) || dados.metasSocios[0];
                setMetaSocioEdicao(meta || null);
                setModalMetasAberto(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white px-3 py-2 text-xs font-bold transition-all"
            >
              <Calculator className="h-3.5 w-3.5 text-cyan-300" />
              Metas de Venda
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white px-3 py-2 text-xs font-bold transition-all print:hidden"
              title="Imprimir relatório"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* FRASE DE STATUS INSTANTÂNEA */}
      <div
        className={`rounded-2xl border p-5 md:p-6 shadow-sm transition-all ${
          dados.statusTipo === "credito"
            ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 text-emerald-950"
            : dados.statusTipo === "devedor"
            ? "bg-gradient-to-r from-rose-50 to-amber-50 border-rose-200 text-rose-950"
            : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-950"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`rounded-xl p-3 shrink-0 ${
                dados.statusTipo === "credito"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : dados.statusTipo === "devedor"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                  : "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              }`}
            >
              {dados.statusTipo === "credito" ? (
                <ShieldCheck className="h-6 w-6" />
              ) : dados.statusTipo === "devedor" ? (
                <ShieldAlert className="h-6 w-6" />
              ) : (
                <Scale className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider opacity-75">
                Situação Financeira Consolidada · {formatDataBr(competencia)}
              </p>
              <h2 className="text-lg md:text-xl font-black mt-0.5 leading-snug">
                {dados.fraseStatus}
              </h2>
              <p className="mt-1 text-xs opacity-80">
                {socioAtivo
                  ? `Análise individual para ${socioAtivo.nome} (${socioAtivo.percentualParticipacao}% de participação societária).`
                  : "Visão consolidada da empresa integrando todos os sócios do quadro societário."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
            {dados.disponivelParaSaque > 0 && (
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                  Disponível p/ Saque
                </span>
                <span className="text-2xl font-black text-emerald-950">
                  {brl(dados.disponivelParaSaque)}
                </span>
              </div>
            )}
            {dados.saldoACompensar > 0 && (
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">
                  A Compensar
                </span>
                <span className="text-2xl font-black text-rose-950">
                  {brl(dados.saldoACompensar)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PAINEL DE CONCILIAÇÃO: SALDO INICIAL vs MOVIMENTAÇÃO vs SALDO ACUMULADO */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        {dados.isTodosPeriodos ? (
          /* VISÃO: TODOS OS PERÍODOS (CONSOLIDADO GERAL) */
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">
                  Posição Histórica Geral
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {socioAtivo?.nome || "Consolidado da Empresa"} — Consolidado de Todos os Períodos
                </h3>
                <p className="text-xs text-slate-500">
                  Acumulado histórico integral desde o início dos lançamentos na plataforma
                </p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700 border border-indigo-200">
                Histórico Geral Acumulado
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Total de Comissões
                </span>
                <p className="text-xl font-black text-blue-950 mt-1">
                  {brl(dados.totalComissoesGeral)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Faturadas e garantidas</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Responsabilidade Despesas
                </span>
                <p className="text-xl font-black text-indigo-950 mt-1">
                  {brl(dados.totalDespesasResponsabilidadeGeral)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Cota das contas da empresa</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Total Pago do Próprio Bolso
                </span>
                <p className="text-xl font-black text-teal-950 mt-1">
                  {brl(dados.totalPagoBolsoGeral)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Desembolsos pessoais</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Total de Compensações
                </span>
                <p className="text-xl font-black text-amber-950 mt-1">
                  {brl(dados.totalCompensacoesGeral)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Comissões retidas p/ despesas</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Total de Saques / Repasses
                </span>
                <p className="text-xl font-black text-purple-950 mt-1">
                  {brl(dados.totalSaquesGeral)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Retiradas já efetuadas</p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
                  Reservas Atuais Vigentes
                </span>
                <p className="text-xl font-black text-amber-950 mt-1">
                  {brl(dados.reservaProximasDespesas)}
                </p>
                <p className="text-[10px] text-amber-800 mt-0.5">Aluguel, folha e custos retidos</p>
              </div>

              <div className="rounded-2xl border border-slate-900 bg-slate-950 text-white p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  SALDO ATUAL ACUMULADO
                </span>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {brl(dados.saldoAcumuladoFinal)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Patrimônio líquido do sócio</p>
              </div>

              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                  DISPONÍVEL PARA SAQUE
                </span>
                <p className="text-2xl font-black text-emerald-950 mt-1">
                  {brl(dados.disponivelParaSaque)}
                </p>
                <p className="text-[10px] text-emerald-700 mt-0.5">Livre p/ transferência imediata</p>
              </div>
            </div>
          </div>
        ) : (
          /* VISÃO: PERÍODO ESPECÍFICO (SALDO INICIAL + MOVIMENTAÇÕES = SALDO FINAL) */
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">
                  Conferência de Fechamento do Período
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {dados.rotuloPeriodo} — Conciliação Encadeada de Saldos
                </h3>
                <p className="text-xs text-slate-500">
                  Demonstração clara do saldo inicial herdado somado à movimentação líquida do período
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-700 font-bold">
                Intervalo: <span className="font-black text-slate-950">{formatDataBr(dados.dataInicio)}</span> até <span className="font-black text-slate-950">{formatDataBr(dados.dataFim)}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              {/* Saldo Inicial */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    1. Saldo Inicial ({formatDataBr(dados.dataInicio)})
                  </span>
                  <p className="text-2xl font-black text-slate-900 mt-1.5">
                    {brl(dados.saldoInicialPeriodo)}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Saldo acumulado anterior herdado
                </p>
              </div>

              {/* Movimentações do Período */}
              <div className={`rounded-2xl border p-4 flex flex-col justify-between ${
                dados.movimentacaoPeriodoLiquida >= 0
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-rose-200 bg-rose-50/40"
              }`}>
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-wider block ${
                    dados.movimentacaoPeriodoLiquida >= 0 ? "text-emerald-800" : "text-rose-800"
                  }`}>
                    2. Movimentação Líquida
                  </span>
                  <p className={`text-2xl font-black mt-1.5 ${
                    dados.movimentacaoPeriodoLiquida >= 0 ? "text-emerald-900" : "text-rose-900"
                  }`}>
                    {dados.movimentacaoPeriodoLiquida >= 0 ? "+" : ""} {brl(dados.movimentacaoPeriodoLiquida)}
                  </p>
                </div>
                <div className="text-[11px] space-y-0.5 mt-2 font-medium">
                  <div className="text-emerald-800 flex justify-between">
                    <span>Créditos:</span> <span>+{brl(dados.creditosPeriodo)}</span>
                  </div>
                  <div className="text-rose-800 flex justify-between">
                    <span>Débitos:</span> <span>-{brl(dados.debitosPeriodo)}</span>
                  </div>
                  {dados.saquesPeriodo > 0 && (
                    <div className="text-purple-800 flex justify-between">
                      <span>Saques:</span> <span>-{brl(dados.saquesPeriodo)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Saldo Final */}
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 block">
                    3. Saldo Final ({formatDataBr(dados.dataFim)})
                  </span>
                  <p className="text-2xl font-black text-indigo-950 mt-1.5">
                    {brl(dados.saldoAcumuladoFinal)}
                  </p>
                </div>
                <p className="text-[11px] text-indigo-800 mt-2 font-medium">
                  Saldo Inicial + Movimentação Líquida
                </p>
              </div>

              {/* Disponível para Saque */}
              <div className="rounded-2xl border border-emerald-300 bg-gradient-to-b from-emerald-50 to-teal-50/80 p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block">
                    4. Disponível para Saque
                  </span>
                  <p className="text-2xl font-black text-emerald-950 mt-1.5">
                    {brl(dados.disponivelParaSaque)}
                  </p>
                </div>
                <p className="text-[11px] text-emerald-800 mt-2 font-medium">
                  {dados.reservaProximasDespesas > 0
                    ? `Deduzidas ${brl(dados.reservaProximasDespesas)} em reservas`
                    : "Livre para transferência"}
                </p>
              </div>
            </div>

            {/* Aviso didático: Diferença entre Movimentação e Saldo */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="h-4 w-4 text-indigo-600 shrink-0" />
                <span className="text-slate-600">
                  <strong>Atenção:</strong> Não confunda a <strong>Movimentação do Período ({brl(dados.movimentacaoPeriodoLiquida)})</strong> com o <strong>Saldo Acumulado Total ({brl(dados.saldoAcumuladoFinal)})</strong>. O saldo acumulado traz o patrimônio anterior somado às operações do mês.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAbaAtiva("fechamentos")}
                className="text-xs font-black text-indigo-700 hover:underline shrink-0 ml-3"
              >
                Ver Quadro de Conferência →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* CARDS PRINCIPAIS (6 CARDS RESUMIDOS) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* 1. Comissões Garantidas */}
        <div
          onClick={() => {
            setAbaAtiva("comissoes");
            setFiltroComissao("GARANTIDA");
          }}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider">Comissões Garantidas</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-blue-950">
            {brl(dados.comissoesGarantidas)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Elegíveis / faturadas no período
          </p>
        </div>

        {/* 2. Despesas da Minha Responsabilidade */}
        <div
          onClick={() => {
            setAbaAtiva("despesas");
          }}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider">Responsabilidade</span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-indigo-950">
            {brl(dados.despesasMinhaResponsabilidade)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Minha cota nas contas da empresa
          </p>
        </div>

        {/* 3. Despesas que Já Paguei */}
        <div
          onClick={() => {
            setAbaAtiva("despesas");
          }}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-teal-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider">Paguei do Bolso</span>
            <div className="rounded-lg bg-teal-50 p-2 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-teal-950">
            {brl(dados.despesasQueEuPaguei)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Contas pagas pessoalmente
          </p>
        </div>

        {/* 4. Saldo a Compensar (vermelho se devedor, ou crédito de equalização) */}
        <div
          onClick={() => {
            setAbaAtiva("ledger");
          }}
          className={`group cursor-pointer rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
            dados.saldoACompensar > 0
              ? "border-rose-300 bg-rose-50/50 hover:border-rose-400"
              : "border-slate-200 bg-white hover:border-emerald-400"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider">
              {dados.saldoACompensar > 0 ? "A Compensar" : "Equalização"}
            </span>
            <div
              className={`rounded-lg p-2 transition-colors ${
                dados.saldoACompensar > 0
                  ? "bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white"
                  : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
              }`}
            >
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`mt-3 text-2xl font-black ${
              dados.saldoACompensar > 0 ? "text-rose-700" : "text-emerald-800"
            }`}
          >
            {dados.saldoACompensar > 0
              ? brl(dados.saldoACompensar)
              : brl(dados.saldoCreditoEqualizacao)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {dados.saldoACompensar > 0
              ? "Débito a amortizar na empresa"
              : "Crédito a receber da empresa"}
          </p>
        </div>

        {/* 5. Reserva para Próximas Despesas (Amarelo) */}
        <div
          onClick={() => {
            setAbaAtiva("previsao");
          }}
          className="group cursor-pointer rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm transition-all hover:border-amber-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-amber-900">
            <span className="text-xs font-black uppercase tracking-wider">Reservas Futuras</span>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Lock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-amber-950">
            {brl(dados.reservaProximasDespesas)}
          </p>
          <p className="mt-1 text-[11px] text-amber-800/80">
            Retido para aluguel, folha e custos
          </p>
        </div>

        {/* 6. Disponível para Saque (Verde Grande) */}
        <div
          onClick={() => {
            setAbaAtiva("fechamentos");
          }}
          className="group cursor-pointer rounded-2xl border border-emerald-300 bg-gradient-to-b from-emerald-50 to-teal-50/70 p-5 shadow-sm transition-all hover:border-emerald-500 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-emerald-900">
            <span className="text-xs font-black uppercase tracking-wider">Disponível Saque</span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-900">
            {brl(dados.disponivelParaSaque)}
          </p>
          <p className="mt-1 text-[11px] text-emerald-700/80 font-medium">
            Livre para retirada imediata
          </p>
        </div>
      </section>

      {/* TERMÔMETRO DO MÊS (% DE COBERTURA DA EMPRESA) & METAS INDIVIDUAIS */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Termômetro de Cobertura */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Termômetro da Empresa
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Cobertura das Despesas Previstas
                </h3>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  dados.percentualCoberturaEmpresa >= 100
                    ? "bg-emerald-100 text-emerald-800"
                    : dados.percentualCoberturaEmpresa >= 60
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {formatPct(dados.percentualCoberturaEmpresa)} coberto
              </span>
            </div>

            {/* Barra de Progresso do Termômetro */}
            <div className="mt-5">
              <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                <span>Garantido: {brl(dados.recursosGarantidosEmpresa)}</span>
                <span>Meta Despesas: {brl(dados.despesasPrevistasEmpresa)}</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    dados.percentualCoberturaEmpresa >= 100
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                      : dados.percentualCoberturaEmpresa >= 60
                      ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                      : "bg-gradient-to-r from-rose-500 to-orange-400"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, dados.percentualCoberturaEmpresa))}%`,
                  }}
                />
              </div>
            </div>

            {/* Break-Even Financeiro */}
            <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Falta para cobrir as contas:</span>
                <span className="font-black text-slate-900">
                  {brl(dados.faltaCobrirEmpresa)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-slate-500 font-medium">
                  Taxa média de comissão de referência:
                </span>
                <span className="font-bold text-indigo-700">
                  {dados.taxaComissaoReferencia}%
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Break-Even (Vendas Necessárias)
                  </span>
                  <p className="text-xs text-slate-400">
                    Volume em créditos para atingir o equilíbrio
                  </p>
                </div>
                <span className="text-base font-black text-slate-950">
                  {brl(dados.vendasNecessariasEmpresa)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            <span>Vendas realizadas no mês: {brl(dados.vendasRealizadasEmpresa)}</span>
            <button
              onClick={() => {
                setAbaAtiva("previsao");
              }}
              className="font-bold text-blue-700 hover:underline flex items-center gap-1"
            >
              Ver projeção de despesas <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Metas Individuais dos Sócios */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Equilíbrio Financeiro
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Metas de Venda por Sócio
                </h3>
              </div>
              <button
                onClick={() => setModalMetasAberto(true)}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded-lg transition-colors"
              >
                Ajustar Metas
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {dados.metasSocios.map((meta) => (
                <div
                  key={meta.socioId}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition-all hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center font-black text-xs text-slate-700">
                        {meta.socioNome.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{meta.socioNome}</p>
                        <p className="text-[11px] text-slate-500">
                          Cota de responsabilidade: {meta.percentualDivisao}%
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-black rounded-md px-2 py-0.5 ${
                        meta.percentualAtingido >= 100
                          ? "bg-emerald-100 text-emerald-800"
                          : meta.percentualAtingido >= 50
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {formatPct(meta.percentualAtingido)}
                    </span>
                  </div>

                  {/* Barra individual */}
                  <div className="mt-3">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${
                          meta.percentualAtingido >= 100
                            ? "bg-emerald-500"
                            : meta.percentualAtingido >= 50
                            ? "bg-amber-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, meta.percentualAtingido))}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-500">
                      <span>Realizado: {brl(meta.vendasRealizadasValor)}</span>
                      <span>Meta: {brl(meta.metaVendasValor)}</span>
                    </div>
                  </div>

                  {meta.faltaVenderValor > 0 && (
                    <p className="mt-1 text-right text-[11px] font-bold text-rose-600">
                      Falta vender: {brl(meta.faltaVenderValor)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-3">
            <span>Metas calculadas com base nas despesas fixas e variáveis</span>
            <span>Vendas formalizadas via contratos</span>
          </div>
        </div>
      </section>

      {/* VISÃO 30 / 60 / 90 DIAS */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Planejamento Futuro
            </span>
            <h3 className="text-lg font-black text-slate-900">
              Visão de Cobertura 30 / 60 / 90 Dias
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Projeção baseada nos recebimentos de cotas programadas e despesas orçadas
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* 30 Dias */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-600">Próximos 30 dias</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                  dados.projecao30Dias.percentual >= 100
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {formatPct(dados.projecao30Dias.percentual)}
              </span>
            </div>
            <p className="mt-3 text-xl font-black text-slate-900">
              {brl(dados.projecao30Dias.garantido)}
            </p>
            <p className="text-[11px] text-slate-500">
              Despesas previstas: {brl(dados.projecao30Dias.despesas)}
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, dados.projecao30Dias.percentual))}%`,
                }}
              />
            </div>
          </div>

          {/* 60 Dias */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-600">Próximos 60 dias</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                  dados.projecao60Dias.percentual >= 100
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {formatPct(dados.projecao60Dias.percentual)}
              </span>
            </div>
            <p className="mt-3 text-xl font-black text-slate-900">
              {brl(dados.projecao60Dias.garantido)}
            </p>
            <p className="text-[11px] text-slate-500">
              Despesas previstas: {brl(dados.projecao60Dias.despesas)}
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, dados.projecao60Dias.percentual))}%`,
                }}
              />
            </div>
          </div>

          {/* 90 Dias */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-600">Próximos 90 dias</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                  dados.projecao90Dias.percentual >= 100
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {formatPct(dados.projecao90Dias.percentual)}
              </span>
            </div>
            <p className="mt-3 text-xl font-black text-slate-900">
              {brl(dados.projecao90Dias.garantido)}
            </p>
            <p className="text-[11px] text-slate-500">
              Despesas previstas: {brl(dados.projecao90Dias.despesas)}
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, dados.projecao90Dias.percentual))}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO DE ABAS OPERACIONAIS */}
      <section className="space-y-4">
        {/* Navegação de Abas */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2">
          {[
            { id: "resumo", label: "Resumo & Indicadores", icon: PieChart },
            {
              id: "despesas",
              label: `Despesas & Rateios (${dados.despesasRateadas.length})`,
              icon: TrendingDown,
            },
            {
              id: "comissoes",
              label: `Comissões (${dados.comissoesSocio.length})`,
              icon: Coins,
            },
            {
              id: "ledger",
              label: `Conta-Corrente / Ledger (${dados.ledgerExtrato.length})`,
              icon: History,
            },
            {
              id: "previsao",
              label: `Previsão & Reservas (${dados.reservas.length})`,
              icon: Lock,
            },
            { id: "fechamentos", label: `Conferência & Auditoria (${dados.conferenciaMensal.length})`, icon: Scale },
          ].map((aba) => {
            const Icon = aba.icon;
            const ativa = abaAtiva === aba.id;
            return (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id as any)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                  ativa
                    ? "bg-slate-950 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {aba.label}
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO DA ABA 1: RESUMO */}
        {abaAtiva === "resumo" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Extrato Sintético do Sócio
                </h3>
                <p className="text-xs text-slate-500">
                  Visão rápida da conciliação entre faturamento, rateio e desembolsos pessoais
                </p>
              </div>
              <button
                onClick={() => setModoVisualizacao("detalhada")}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Alternar para Visão Detalhada →
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-black">
                  <tr>
                    <th className="p-3.5">Indicador Financeiro</th>
                    <th className="p-3.5 text-right">Valor Consolidado</th>
                    <th className="p-3.5">Impacto no Saldo</th>
                    <th className="p-3.5">Explicação Operacional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-3.5 font-black text-slate-900 flex items-center gap-2">
                      <Coins className="h-4 w-4 text-blue-600" />
                      Comissões Faturadas & Garantidas
                    </td>
                    <td className="p-3.5 text-right font-black text-blue-800 text-sm">
                      {brl(dados.comissoesGarantidas)}
                    </td>
                    <td className="p-3.5">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">
                        CRÉDITO (+)
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">
                      Receitas já geradas pelas vendas do sócio no período.
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-black text-slate-900 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-indigo-600" />
                      Despesas de Minha Responsabilidade
                    </td>
                    <td className="p-3.5 text-right font-black text-indigo-900 text-sm">
                      {brl(dados.despesasMinhaResponsabilidade)}
                    </td>
                    <td className="p-3.5">
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700">
                        DÉBITO (-)
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">
                      Cota societária nas despesas operacionais da empresa.
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-black text-slate-900 flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-teal-600" />
                      Despesas Pagas do Próprio Bolso
                    </td>
                    <td className="p-3.5 text-right font-black text-teal-800 text-sm">
                      {brl(dados.despesasQueEuPaguei)}
                    </td>
                    <td className="p-3.5">
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-black text-teal-700">
                        REEMBOLSO (+)
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">
                      Valores desembolsados pessoalmente que reduzem o débito do sócio.
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-black text-slate-900 flex items-center gap-2">
                      <Lock className="h-4 w-4 text-amber-600" />
                      Reservas para Próximas Despesas
                    </td>
                    <td className="p-3.5 text-right font-black text-amber-900 text-sm">
                      {brl(dados.reservaProximasDespesas)}
                    </td>
                    <td className="p-3.5">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
                        RETENÇÃO
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">
                      Provisão retida na empresa para aluguel, folha e custos fixos futuros.
                    </td>
                  </tr>

                  <tr className="bg-emerald-50/40">
                    <td className="p-3.5 font-black text-emerald-950 flex items-center gap-2 text-sm">
                      <ArrowDownLeft className="h-5 w-5 text-emerald-700" />
                      Disponível Efetivo para Saque
                    </td>
                    <td className="p-3.5 text-right font-black text-emerald-900 text-base">
                      {brl(dados.disponivelParaSaque)}
                    </td>
                    <td className="p-3.5">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800">
                        LIVRE
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-emerald-900">
                      Valor final liberado para retirada bancária sem comprometer o caixa.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA 2: DESPESAS & RATEIOS */}
        {abaAtiva === "despesas" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Despesas e Divisão de Rateio
                </h3>
                <p className="text-xs text-slate-500">
                  Todas as despesas da empresa, identificação de pagador e fatia de cada sócio
                </p>
              </div>

              {/* Filtros de Despesas */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar despesa..."
                    value={buscaDespesa}
                    onChange={(e) => setBuscaDespesa(e.target.value)}
                    className="rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none w-52"
                  />
                </div>

                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
                  {(["TODAS", "aberta", "paga"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFiltroDespesaStatus(status)}
                      className={`rounded-lg px-3 py-1 transition-all ${
                        filtroDespesaStatus === status
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {status === "TODAS" ? "Todas" : status === "aberta" ? "Em Aberto" : "Pagas"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabela de Despesas */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Data/Vencimento</th>
                    <th className="p-3">Descrição / Categoria</th>
                    <th className="p-3 text-right">Valor Total</th>
                    <th className="p-3">Quem Pagou</th>
                    <th className="p-3">Regra de Rateio</th>
                    <th className="p-3 text-right">Minha Parte</th>
                    <th className="p-3 text-right">Paguei do Bolso</th>
                    <th className="p-3 text-right">Saldo / Diferença</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {despesasFiltradas.map((d) => {
                    const isCredor = d.saldoDiferenca > 0;
                    const isDevedor = d.saldoDiferenca < 0;

                    return (
                      <tr key={d.contaId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 whitespace-nowrap">
                          <p className="font-bold text-slate-900">{formatDataBr(d.vencimento)}</p>
                          <p className="text-[10px] text-slate-400">{d.competencia}</p>
                        </td>

                        <td className="p-3">
                          <p className="font-black text-slate-900">{d.descricao}</p>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {d.categoria}
                          </span>
                          {d.comprovanteUrl && (
                            <a
                              href={d.comprovanteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-[10px] text-blue-600 underline font-bold"
                            >
                              Comprovante
                            </a>
                          )}
                        </td>

                        <td className="p-3 text-right font-black text-slate-950 whitespace-nowrap">
                          {brl(d.valorTotal)}
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          {d.pagoPessoalmente ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-900">
                              <User className="h-3 w-3" />
                              {d.pagoPorSocioNome || "Sócio Pessoal"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black text-blue-900">
                              Empresa
                            </span>
                          )}
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {d.formaRateio === "IGUAL_50_50"
                              ? "50% / 50%"
                              : d.formaRateio === "PERCENTUAL_SOCIETARIO"
                              ? "Societário"
                              : d.formaRateio === "EXCLUSIVO_SOCIO"
                              ? "Exclusivo Sócio"
                              : "Empresa 100%"}
                          </span>
                        </td>

                        <td className="p-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {brl(d.minhaParteResponsabilidade)}
                        </td>

                        <td className="p-3 text-right font-bold text-teal-800 whitespace-nowrap">
                          {d.quantoEuPaguei > 0 ? brl(d.quantoEuPaguei) : "-"}
                        </td>

                        <td className="p-3 text-right whitespace-nowrap">
                          <span
                            className={`font-black ${
                              isCredor
                                ? "text-teal-700"
                                : isDevedor
                                ? "text-rose-700"
                                : "text-slate-500"
                            }`}
                          >
                            {isCredor ? `+ ${brl(d.saldoDiferenca)}` : isDevedor ? `- ${brl(Math.abs(d.saldoDiferenca))}` : "R$ 0,00"}
                          </span>
                        </td>

                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                              d.status === "paga"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {d.status === "paga" ? "Paga" : "Aberta"}
                          </span>
                        </td>

                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setDespesaParaRateio(d);
                              setModalRateioAberto(true);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                          >
                            Configurar Rateio
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {!despesasFiltradas.length && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-xs text-slate-500">
                        Nenhuma despesa encontrada para os critérios selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA 3: COMISSÕES */}
        {abaAtiva === "comissoes" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Comissões Pertencentes ao Sócio
                </h3>
                <p className="text-xs text-slate-500">
                  Garantidas, previstas por etapa, recebidas e compensadas na empresa
                </p>
              </div>

              {/* Filtros de Comissões */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente/cota..."
                    value={buscaComissao}
                    onChange={(e) => setBuscaComissao(e.target.value)}
                    className="rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none w-52"
                  />
                </div>

                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
                  {(["TODAS", "GARANTIDA", "PREVISTA", "RECEBIDA", "COMPENSADA"] as const).map(
                    (tipo) => (
                      <button
                        key={tipo}
                        onClick={() => setFiltroComissao(tipo)}
                        className={`rounded-lg px-2.5 py-1 transition-all ${
                          filtroComissao === tipo
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {tipo === "TODAS"
                          ? "Todas"
                          : tipo === "GARANTIDA"
                          ? "Garantidas"
                          : tipo === "PREVISTA"
                          ? "Previstas"
                          : tipo === "RECEBIDA"
                          ? "Recebidas"
                          : "Compensadas"}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Tabela de Comissões */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Competência / Venda</th>
                    <th className="p-3">Cliente / Cota</th>
                    <th className="p-3">Etapa de Comissão</th>
                    <th className="p-3 text-right">Valor Previsto</th>
                    <th className="p-3 text-right">Valor Elegível</th>
                    <th className="p-3 text-right">Valor Pago</th>
                    <th className="p-3 text-center">Classificação</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {comissoesFiltradas.map((c) => {
                    const saldoDisponivelNaPrevisao =
                      Math.max(0, (c.valorElegivel || c.valorPrevisto) - c.valorPago);
                    const podeCompensar =
                      saldoDisponivelNaPrevisao > 0 &&
                      (c.status === "elegivel" || c.status === "parcialmente_elegivel" || c.status === "prevista");

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 whitespace-nowrap">
                          <p className="font-black text-slate-900">{c.competencia}</p>
                          <p className="text-[10px] text-slate-400">
                            {c.dataVenda ? `Venda: ${formatDataBr(c.dataVenda)}` : "Sem data"}
                          </p>
                        </td>

                        <td className="p-3">
                          <p className="font-bold text-slate-900">{c.clienteNome || "Cliente não informado"}</p>
                          <p className="text-[10px] text-slate-500">
                            {c.cotaInfo || "Cota / Contrato"}
                            {c.valorCredito ? ` · Crédito ${brl(c.valorCredito)}` : ""}
                          </p>
                        </td>

                        <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                          {c.etapaNome}
                        </td>

                        <td className="p-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {brl(c.valorPrevisto)}
                        </td>

                        <td className="p-3 text-right font-black text-blue-800 whitespace-nowrap">
                          {brl(c.valorElegivel)}
                        </td>

                        <td className="p-3 text-right font-black text-emerald-800 whitespace-nowrap">
                          {brl(c.valorPago)}
                        </td>

                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                              c.tipoClassificacao === "GARANTIDA"
                                ? "bg-blue-100 text-blue-900"
                                : c.tipoClassificacao === "RECEBIDA"
                                ? "bg-emerald-100 text-emerald-900"
                                : c.tipoClassificacao === "COMPENSADA"
                                ? "bg-purple-100 text-purple-900"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {c.tipoClassificacao}
                          </span>
                        </td>

                        <td className="p-3 text-right whitespace-nowrap">
                          {podeCompensar ? (
                            <button
                              onClick={() => {
                                setComissaoParaCompensar(c);
                                setModalCompensarAberto(true);
                              }}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-[11px] font-black shadow-sm transition-all"
                            >
                              Compensar Despesa
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">Totalmente compensada/paga</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!comissoesFiltradas.length && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-slate-500">
                        Nenhuma previsão de comissão encontrada para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA 4: CONTA-CORRENTE / LEDGER */}
        {abaAtiva === "ledger" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Extrato da Conta-Corrente dos Sócios (Ledger)
                </h3>
                <p className="text-xs text-slate-500">
                  Registro cronológico imutável com auditoria, sem deleções físicas e com estornos vinculados
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  Total de Lançamentos: {dados.ledgerExtrato.length}
                </span>
              </div>
            </div>

            {/* Tabela do Ledger */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Natureza</th>
                    <th className="p-3">Tipo de Movimento</th>
                    <th className="p-3">Descrição / Origem</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-center">Status / Auditoria</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dados.ledgerExtrato.map((m) => {
                    const isCredito = m.natureza === "CREDITO";

                    return (
                      <tr
                        key={m.id}
                        className={`transition-colors ${
                          m.estornado ? "bg-slate-50 opacity-60" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                          {formatDataBr(m.dataMovimento)}
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                              isCredito
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {isCredito ? "CRÉDITO (+)" : "DÉBITO (-)"}
                          </span>
                        </td>

                        <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                          {m.tipoMovimento}
                        </td>

                        <td className="p-3">
                          <p className="font-bold text-slate-900">{m.descricao}</p>
                          {m.socioNome && (
                            <p className="text-[10px] text-slate-500">Sócio: {m.socioNome}</p>
                          )}
                        </td>

                        <td className="p-3 text-right font-black whitespace-nowrap">
                          <span
                            className={
                              isCredito ? "text-emerald-700 font-black" : "text-rose-700 font-black"
                            }
                          >
                            {isCredito ? "+" : "-"} {brl(m.valor)}
                          </span>
                        </td>

                        <td className="p-3 text-center whitespace-nowrap">
                          {m.estornado ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-800">
                              ESTORNADO
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              Confirmado
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-right whitespace-nowrap">
                          {!m.estornado && m.tipoMovimento !== "ESTORNO" && (
                            <button
                              onClick={() => {
                                setMovimentoParaEstorno(m);
                                setModalEstornoAberto(true);
                              }}
                              className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition-colors"
                            >
                              Estornar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!dados.ledgerExtrato.length && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-slate-500">
                        Nenhum lançamento no ledger financeiro dos sócios até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA 5: PREVISÃO & RESERVAS */}
        {abaAtiva === "previsao" && (
          <div className="space-y-6">
            {/* Reservas Futuras Cadastradas */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Reservas de Caixa para Próximas Despesas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Valores retidos preventivamente para aluguel, folha de pagamento, tributos e contingências
                  </p>
                </div>
                <button
                  onClick={() => setModalReservaAberto(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-2 text-xs font-black shadow-sm transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Nova Reserva
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {dados.reservas.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-amber-200/70 px-2.5 py-0.5 text-[10px] font-black text-amber-900 uppercase tracking-wider">
                        {r.categoria}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          r.status === "ATIVA"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div>
                      <p className="text-2xl font-black text-amber-950">{brl(r.valor)}</p>
                      <p className="text-xs font-bold text-slate-800 mt-1">{r.descricao}</p>
                      <p className="text-[11px] text-slate-500">
                        Competência: {r.competencia} {r.socioNome ? `· ${r.socioNome}` : ""}
                      </p>
                    </div>

                    {r.status === "ATIVA" && (
                      <button
                        onClick={() => handleLiberarReserva(r.id)}
                        className="w-full rounded-xl border border-amber-300 bg-white py-2 text-xs font-black text-amber-900 hover:bg-amber-100 transition-colors"
                      >
                        Liberar para Saque
                      </button>
                    )}
                  </div>
                ))}

                {!dados.reservas.length && (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                    Nenhuma reserva cadastrada para este período.
                  </div>
                )}
              </div>
            </div>

            {/* Orçamento Operacional (Fixas e Variáveis) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Previsão Orçamentária da Empresa
                </h3>
                <p className="text-xs text-slate-500">
                  Despesas fixas recorrentes e variáveis sugeridas automaticamente com base nos últimos 3 meses
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Categoria da Despesa</th>
                      <th className="p-3">Classificação</th>
                      <th className="p-3 text-right">Média Histórica (Sugerida)</th>
                      <th className="p-3 text-right">Previsto Administrativo</th>
                      <th className="p-3 text-right">Efetivo Utilizado</th>
                      <th className="p-3">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dados.orcamento.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{item.categoria}</td>
                        <td className="p-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {item.tipo}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium text-slate-600">
                          {brl(item.valorSugeridoSistema)}
                        </td>
                        <td className="p-3 text-right font-bold text-indigo-700">
                          {item.valorPrevistoAdmin > 0 ? brl(item.valorPrevistoAdmin) : "-"}
                        </td>
                        <td className="p-3 text-right font-black text-slate-900">
                          {brl(item.valorEfetivoUtilizado)}
                        </td>
                        <td className="p-3 text-slate-500">{item.observacoes || "-"}</td>
                      </tr>
                    ))}

                    {!dados.orcamento.length && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-slate-500">
                          Nenhum orçamento configurado para a competência.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA 6: FECHAMENTOS */}
        {abaAtiva === "fechamentos" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Fechamento & Equalização Societária
                </h3>
                <p className="text-xs text-slate-500">
                  Quadro comparativo entre todos os sócios com instruções de repasse para conciliação 50/50
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl bg-slate-950 text-white px-4 py-2 text-xs font-black shadow transition-all hover:bg-slate-800"
              >
                <Printer className="h-4 w-4" />
                Imprimir Relatório de Fechamento
              </button>
            </div>

            {/* Comparativo de Sócios */}
            <div className="grid gap-6 md:grid-cols-2">
              {dados.todosSocios.map((socio) => {
                const meta = dados.metasSocios.find((m) => m.socioId === socio.id);

                return (
                  <div
                    key={socio.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <h4 className="text-base font-black text-slate-900">{socio.nome}</h4>
                        <p className="text-xs text-slate-500">
                          Participação Societária: {socio.percentualParticipacao}%
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-900">
                        {socio.ativo ? "Sócio Ativo" : "Inativo"}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Vendas Formalizadas no Mês:</span>
                        <span className="font-bold text-slate-900">
                          {brl(meta?.vendasRealizadasValor || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Meta Estabelecida de Vendas:</span>
                        <span className="font-bold text-slate-900">
                          {brl(meta?.metaVendasValor || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Comissões Garantidas:</span>
                        <span className="font-black text-blue-800">
                          {brl(dados.comissoesGarantidas)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Responsabilidade em Despesas:</span>
                        <span className="font-black text-indigo-900">
                          {brl(dados.despesasMinhaResponsabilidade)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Despesas Pagas do Próprio Bolso:</span>
                        <span className="font-black text-teal-800">
                          {brl(dados.despesasQueEuPaguei)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Reservas Retidas:</span>
                        <span className="font-black text-amber-800">
                          {brl(dados.reservaProximasDespesas)}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-4 border border-slate-200 mt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-slate-600">
                          Saldo Líquido Disponível
                        </span>
                        <span className="text-xl font-black text-emerald-800">
                          {brl(dados.disponivelParaSaque)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* QUADRO DE CONFERÊNCIA MENSAL (AUDIT TABLE) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">
                    Auditoria Mês a Mês Encadeada
                  </span>
                  <h3 className="text-lg font-black text-slate-900">
                    Quadro de Conferência Mensal
                  </h3>
                  <p className="text-xs text-slate-500">
                    O saldo inicial de cada competência é rigorosamente igual ao saldo final da competência anterior. Clique em qualquer linha para abrir o Drill-Down analítico.
                  </p>
                </div>
                <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-600 font-bold">
                  {dados.conferenciaMensal.length} competências apuradas
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Competência</th>
                      <th className="p-3 text-right">Saldo Inicial</th>
                      <th className="p-3 text-right text-emerald-700">Créditos (+)</th>
                      <th className="p-3 text-right text-rose-700">Débitos (-)</th>
                      <th className="p-3 text-right text-amber-700">Reservas</th>
                      <th className="p-3 text-right text-purple-700">Saques (-)</th>
                      <th className="p-3 text-right">Ajustes</th>
                      <th className="p-3 text-right font-black bg-slate-100/60">Saldo Final</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Drill-Down</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dados.conferenciaMensal.map((m) => (
                      <tr
                        key={m.competencia}
                        onClick={() => setMesDrillDownSelecionado(m)}
                        className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                        title="Clique para inspecionar os lançamentos analíticos deste fechamento"
                      >
                        <td className="p-3 font-black text-slate-900 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                            {m.rotuloCompetencia}
                          </span>
                          <span className="text-[10px] text-slate-400 block">{m.competencia}</span>
                        </td>
                        <td className="p-3 text-right font-bold text-slate-700 whitespace-nowrap">
                          {brl(m.saldoInicial)}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                          +{brl(m.creditos)}
                        </td>
                        <td className="p-3 text-right font-bold text-rose-700 whitespace-nowrap">
                          -{brl(m.debitos)}
                        </td>
                        <td className="p-3 text-right font-medium text-amber-800 whitespace-nowrap">
                          {brl(m.reservas)}
                        </td>
                        <td className="p-3 text-right font-bold text-purple-700 whitespace-nowrap">
                          -{brl(m.saques)}
                        </td>
                        <td className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">
                          {m.ajustes !== 0 ? brl(m.ajustes) : "-"}
                        </td>
                        <td className="p-3 text-right font-black text-slate-950 bg-slate-50/60 whitespace-nowrap">
                          {brl(m.saldoFinal)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                              m.statusFechamento === "FECHADO"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {m.statusFechamento}
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMesDrillDownSelecionado(m);
                            }}
                            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-black text-indigo-700 hover:bg-indigo-50 shadow-sm transition-colors"
                          >
                            Drill-Down ({m.totalLancamentos})
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FECHAMENTO GERAL & RECONCILIAÇÃO DO LEDGER */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Conferência e Integridade do Livro Contábil
                  </span>
                  <h3 className="text-lg font-black text-slate-900">
                    Fechamento Geral & Auditoria do Ledger
                  </h3>
                  <p className="text-xs text-slate-500">
                    Validação matemática: Saldo inicial histórico (R$ 0,00) + Créditos - Débitos - Saques = Saldo Atual
                  </p>
                </div>

                <span
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
                    dados.fechamentoGeral.status === "OK"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800 animate-pulse"
                  }`}
                >
                  {dados.fechamentoGeral.status === "OK" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                  )}
                  {dados.fechamentoGeral.status === "OK" ? "LEDGER CONCILIADO (OK)" : "ALERTA DE DIVERGÊNCIA"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Saldo Calculado pelo Ledger
                  </span>
                  <p className="text-2xl font-black text-slate-950 mt-1">
                    {brl(dados.fechamentoGeral.saldoCalculadoHistorico)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Lançamentos imutáveis append-only
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Saldo Exibido no Dashboard
                  </span>
                  <p className="text-2xl font-black text-indigo-950 mt-1">
                    {brl(dados.fechamentoGeral.saldoExibidoDashboard)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Apuração operacional
                  </p>
                </div>

                <div className={`rounded-2xl border p-4 ${
                  dados.fechamentoGeral.status === "OK"
                    ? "border-emerald-200 bg-emerald-50/50 text-emerald-950"
                    : "border-rose-300 bg-rose-50 text-rose-950"
                }`}>
                  <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">
                    Diferença Identificada
                  </span>
                  <p className="text-2xl font-black mt-1">
                    {brl(dados.fechamentoGeral.divergencia)}
                  </p>
                  <p className="text-[10px] mt-0.5 opacity-80 font-medium">
                    {dados.fechamentoGeral.mensagemAuditoria}
                  </p>
                </div>
              </div>
            </div>

            {/* Resumo da Equalização */}
            <div className="rounded-2xl bg-indigo-950 p-6 text-white space-y-3">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-amber-400" />
                <h4 className="text-sm font-black uppercase tracking-wider text-amber-300">
                  Equalização Societária Automática
                </h4>
              </div>
              <p className="text-xs text-slate-300">
                O sistema calcula as diferenças de despesas pagas pessoalmente versus a responsabilidade estatutária.
                Quando um dos sócios antecipa custos do próprio bolso, o saldo é equalizado debitando a empresa ou o sócio parceiro para manter rigorosamente a proporção 50/50.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 pt-2 border-t border-white/10">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Saldo Interno Total
                  </span>
                  <span className="text-lg font-black text-white">
                    {brl(dados.saldoInternoTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Reserva Consolidada
                  </span>
                  <span className="text-lg font-black text-amber-300">
                    {brl(dados.reservaProximasDespesas)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* MODAL 1: USAR COMISSÃO PARA COMPENSAR */}
      {modalCompensarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-800">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Usar Comissão para Compensar Despesa
                  </h3>
                  <p className="text-xs text-slate-500">
                    Retém a comissão na empresa para abater sua cota em despesas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalCompensarAberto(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCompensar} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Sócio Titular</label>
                <select
                  name="socio_id"
                  defaultValue={socioAtivo?.id || dados.todosSocios[0]?.id}
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                >
                  {dados.todosSocios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} ({s.percentualParticipacao}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Selecione a Previsão de Comissão
                </label>
                <select
                  name="previsao_id"
                  defaultValue={comissaoParaCompensar?.id || ""}
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Selecione uma comissão...</option>
                  {dados.comissoesSocio
                    .filter((c) => Math.max(0, (c.valorElegivel || c.valorPrevisto) - c.valorPago) > 0)
                    .map((c) => {
                      const disponivel = Math.max(0, (c.valorElegivel || c.valorPrevisto) - c.valorPago);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.clienteNome || "Venda"} - {c.etapaNome} (Disponível: {brl(disponivel)})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Valor a Compensar / Abater (R$)
                </label>
                <input
                  type="text"
                  name="valor"
                  required
                  placeholder="Ex: 1500,00"
                  defaultValue={
                    comissaoParaCompensar
                      ? Math.max(
                          0,
                          (comissaoParaCompensar.valorElegivel || comissaoParaCompensar.valorPrevisto) -
                            comissaoParaCompensar.valorPago
                        ).toFixed(2)
                      : dados.saldoACompensar > 0
                      ? dados.saldoACompensar.toFixed(2)
                      : ""
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-black focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Motivo / Observação da Compensação
                </label>
                <input
                  type="text"
                  name="motivo"
                  defaultValue="Compensação de cota de despesas operacionais retida na empresa"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <p className="font-black">Atenção sobre o fluxo:</p>
                <p>
                  O valor será debitado do saldo de comissões do sócio e aplicado para reduzir o saldo a compensar, gerando um registro imutável no ledger.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalCompensarAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 text-xs font-black shadow-md disabled:opacity-50"
                >
                  {isPending ? "Processando..." : "Confirmar Compensação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURAR RATEIO DE DESPESA */}
      {modalRateioAberto && despesaParaRateio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Configurar Rateio de Despesa
                </h3>
                <p className="text-xs text-slate-500">{despesaParaRateio.descricao}</p>
              </div>
              <button
                onClick={() => setModalRateioAberto(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarRateio} className="space-y-4 text-xs">
              <input type="hidden" name="conta_id" value={despesaParaRateio.contaId} />

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-500">Valor Total</span>
                  <p className="text-lg font-black text-slate-950">{brl(despesaParaRateio.valorTotal)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-black text-slate-500">Vencimento</span>
                  <p className="font-bold text-slate-900">{formatDataBr(despesaParaRateio.vencimento)}</p>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Forma de Rateio</label>
                <select
                  name="forma_rateio"
                  defaultValue={despesaParaRateio.formaRateio}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                >
                  <option value="IGUAL_50_50">50% / 50% (Divisão Igualitária entre Sócios)</option>
                  <option value="PERCENTUAL_SOCIETARIO">Percentual Societário Estatutário</option>
                  <option value="EXCLUSIVO_SOCIO">Exclusivo de um Sócio (100% pessoal)</option>
                  <option value="EMPRESA_INTEGRAL">Empresa Integral (0% dos sócios)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Quem Pagou a Conta?</label>
                <select
                  name="quem_pagou"
                  defaultValue={despesaParaRateio.quemPagou}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                >
                  <option value="EMPRESA">Conta Bancária da Empresa</option>
                  <option value="SOCIO_PESSOAL">Sócio pagou do próprio bolso</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Se pago por sócio, selecione quem pagou:
                </label>
                <select
                  name="pago_por_socio_id"
                  defaultValue={despesaParaRateio.pagoPorSocioId || ""}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Nenhum (pago pela empresa)</option>
                  {dados.todosSocios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalRateioAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-blue-700 hover:bg-blue-600 text-white px-5 py-2 text-xs font-black shadow-md disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : "Salvar Configuração"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADICIONAR RESERVA FUTURA */}
      {modalReservaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Cadastrar Reserva para Próximas Despesas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Retém valor no caixa impedindo retirada antecipada
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalReservaAberto(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarReserva} className="space-y-4 text-xs">
              <input type="hidden" name="competencia" value={competencia} />

              <div>
                <label className="font-bold text-slate-700 block mb-1">Sócio Titular da Reserva</label>
                <select
                  name="socio_id"
                  defaultValue={socioAtivo?.id || dados.todosSocios[0]?.id}
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                >
                  {dados.todosSocios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Finalidade da Reserva</label>
                <select
                  name="categoria"
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALUGUEL">Aluguel do Escritório</option>
                  <option value="FOLHA_SALARIOS">Folha de Pagamento / Salários</option>
                  <option value="IMPOSTOS">Provisão de Impostos e Tributos</option>
                  <option value="CONTINGENCIA">Fundo de Reserva / Contingência</option>
                  <option value="OUTRA">Outra despesa futura</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Valor da Reserva (R$)</label>
                <input
                  type="text"
                  name="valor"
                  required
                  placeholder="Ex: 2500,00"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-black focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Descrição Detalhada</label>
                <input
                  type="text"
                  name="descricao"
                  required
                  placeholder="Ex: Reserva para aluguel da sede com vencimento dia 10"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalReservaAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2 text-xs font-black shadow-md disabled:opacity-50"
                >
                  {isPending ? "Cadastrando..." : "Cadastrar Reserva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: AJUSTAR METAS DE VENDAS */}
      {modalMetasAberto && metaSocioEdicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Ajustar Metas de Venda · {metaSocioEdicao.socioNome}
                </h3>
                <p className="text-xs text-slate-500">
                  Volume de vendas necessário para cobrir despesas e gerar lucro
                </p>
              </div>
              <button
                onClick={() => setModalMetasAberto(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarMetas} className="space-y-4 text-xs">
              <input type="hidden" name="competencia" value={competencia} />
              <input type="hidden" name="socio_id" value={metaSocioEdicao.socioId} />

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Meta de Vendas para o Mês (R$)
                </label>
                <input
                  type="text"
                  name="meta_valor"
                  defaultValue={metaSocioEdicao.metaVendasValor.toFixed(2)}
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-black focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Cota de Responsabilidade (%)
                </label>
                <input
                  type="text"
                  name="percentual_divisao"
                  defaultValue={metaSocioEdicao.percentualDivisao.toFixed(1)}
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Taxa de Comissão de Referência para Break-Even (%)
                </label>
                <input
                  type="text"
                  name="taxa_referencia"
                  defaultValue={dados.taxaComissaoReferencia.toFixed(2)}
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalMetasAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-blue-700 hover:bg-blue-600 text-white px-5 py-2 text-xs font-black shadow-md disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : "Salvar Meta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PERÍODO PERSONALIZADO */}
      {modalPeriodoPersonalizadoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-100 p-2 text-indigo-800">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Período Personalizado
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecione o intervalo de datas (De / Até) para apuração
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPeriodoPersonalizadoAberto(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">De (Data Inicial)</label>
                  <input
                    type="date"
                    value={customDataInicio}
                    onChange={(e) => setCustomDataInicio(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Até (Data Final)</label>
                  <input
                    type="date"
                    value={customDataFim}
                    onChange={(e) => setCustomDataFim(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 border border-slate-200">
                O sistema calculará o saldo inicial em <strong>{formatDataBr(customDataInicio)}</strong>, as movimentações deste intervalo e o saldo final acumulado em <strong>{formatDataBr(customDataFim)}</strong>.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalPeriodoPersonalizadoAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!customDataInicio || !customDataFim) {
                      alert("Informe as datas de início e fim.");
                      return;
                    }
                    setModalPeriodoPersonalizadoAberto(false);
                    alterarFiltros({
                      tipoPeriodo: "personalizado",
                      de: customDataInicio,
                      ate: customDataFim,
                    });
                  }}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 text-xs font-black shadow-md"
                >
                  Aplicar Período
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DRILL-DOWN ANALÍTICO DE FECHAMENTO */}
      {mesDrillDownSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">
                  Drill-Down Analítico de Lançamentos
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Competência {mesDrillDownSelecionado.rotuloCompetencia} ({mesDrillDownSelecionado.competencia})
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                  <span>Status: <strong className="text-slate-900">{mesDrillDownSelecionado.statusFechamento}</strong></span>
                  <span>·</span>
                  <span>Saldo Inicial: <strong className="text-slate-900">{brl(mesDrillDownSelecionado.saldoInicial)}</strong></span>
                  <span>·</span>
                  <span>Saldo Final: <strong className="text-slate-900">{brl(mesDrillDownSelecionado.saldoFinal)}</strong></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMesDrillDownSelecionado(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Descrição do Lançamento</th>
                      <th className="p-3">Origem</th>
                      <th className="p-3 text-right text-rose-700">Débito (-)</th>
                      <th className="p-3 text-right text-emerald-700">Crédito (+)</th>
                      <th className="p-3 text-right">Saldo Resultante</th>
                      <th className="p-3">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {mesDrillDownSelecionado.lancamentos.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                          {formatDataBr(l.data)}
                        </td>
                        <td className="p-3 font-medium text-slate-900">
                          {l.descricao}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {l.origem}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-rose-700 whitespace-nowrap">
                          {l.debito > 0 ? `-${brl(l.debito)}` : "-"}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                          {l.credito > 0 ? `+${brl(l.credito)}` : "-"}
                        </td>
                        <td className="p-3 text-right font-black text-slate-950 whitespace-nowrap">
                          {l.saldoApos !== 0 ? brl(l.saldoApos) : "-"}
                        </td>
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {l.responsavelNome || "-"}
                        </td>
                      </tr>
                    ))}

                    {!mesDrillDownSelecionado.lancamentos.length && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-xs text-slate-500">
                          Nenhum lançamento detalhado registrado para esta competência.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setMesDrillDownSelecionado(null)}
                className="rounded-xl bg-slate-950 text-white px-5 py-2 text-xs font-black shadow-md hover:bg-slate-800"
              >
                Fechar Drill-Down
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ESTORNAR MOVIMENTO LEDGER */}
      {modalEstornoAberto && movimentoParaEstorno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700">
                <RotateCcw className="h-5 w-5" />
                <h3 className="text-base font-black text-slate-900">
                  Estornar Lançamento do Ledger
                </h3>
              </div>
              <button
                onClick={() => setModalEstornoAberto(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-rose-950 space-y-1">
                <p className="font-bold">Lançamento a ser estornado:</p>
                <p className="font-black text-sm">
                  {movimentoParaEstorno.natureza === "CREDITO" ? "+" : "-"}{" "}
                  {brl(movimentoParaEstorno.valor)} · {movimentoParaEstorno.descricao}
                </p>
                <p className="text-[11px] text-rose-800">
                  Data: {formatDataBr(movimentoParaEstorno.dataMovimento)}
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Motivo Obrigatório do Estorno:
                </label>
                <textarea
                  value={motivoEstorno}
                  onChange={(e) => setMotivoEstorno(e.target.value)}
                  placeholder="Descreva a razão da retificação contábil..."
                  rows={3}
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 border border-slate-200">
                O estorno é uma operação imutável. Um lançamento com a natureza inversa será gerado e vinculado permanentemente para fins de conformidade e auditoria.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEstornoAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEstornarLedger}
                  disabled={isPending || !motivoEstorno.trim()}
                  className="rounded-xl bg-rose-700 hover:bg-rose-600 text-white px-5 py-2 text-xs font-black shadow-md disabled:opacity-50"
                >
                  {isPending ? "Processando..." : "Confirmar Estorno"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
