"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  criarSolicitacaoRepasseAction,
  alterarStatusSolicitacaoAction,
  registrarRecebimentoSolicitacaoAction,
  obterUrlDocumentoRepasseAction,
  type SolicitacaoState,
  type ReceiptState,
} from "@/app/erp/repasse-franquia/actions";
import {
  normalizarPedidos,
  formatarMesReferencia,
  verificarDivergenciaValores,
  calcularValorSugeridoRecebimento,
  isElegivelParaRecebimento,
  STATUS_LABELS,
  STATUS_COLORS,
  type SolicitacaoRepasseStatus,
} from "@/lib/erp/repasse-solicitacoes-helpers";
import { ReceiptManager } from "@/components/erp/receipt-manager";

const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type SolicitacaoRepasseItem = {
  id: string;
  empresa_id: string;
  codigo_solicitacao: string;
  administradora_id: string;
  mes_referencia: string;
  data_solicitacao: string;
  valor_solicitado: number;
  numero_nota_fiscal: string | null;
  data_nota_fiscal: string | null;
  valor_nota_fiscal: number | null;
  arquivo_nf_url: string | null;
  arquivo_nf_nome: string | null;
  arquivo_pedidos_url: string | null;
  arquivo_pedidos_nome: string | null;
  observacao: string | null;
  status: SolicitacaoRepasseStatus;
  recebimento_id: string | null;
  created_at: string;
  administradora?: { id: string; nome: string } | null;
  pedidos?: { id: string; numero_pedido: string; arquivo_url: string | null; arquivo_nome: string | null }[];
  historico?: {
    id: string;
    acao: string;
    estado_anterior: Record<string, unknown> | null;
    estado_novo: Record<string, unknown> | null;
    motivo: string | null;
    created_at: string;
  }[];
  recebimento?: {
    id: string;
    data_recebimento: string;
    valor_total: number;
    conta_entrada: string;
    numero_nota_fiscal: string | null;
  } | null;
};

const initialSolic: SolicitacaoState = { ok: false, message: "" };
const initialReceipt: ReceiptState = { ok: false, message: "" };

export function RepasseFranquiaView({
  administradoras,
  contas,
  solicitacoes,
  recebimentos,
  previsoes,
}: {
  administradoras: { id: string; nome: string }[];
  contas: { id: string; nome: string }[];
  solicitacoes: SolicitacaoRepasseItem[];
  recebimentos: Parameters<typeof ReceiptManager>[0]["recebimentos"];
  previsoes: Parameters<typeof ReceiptManager>[0]["previsoes"];
}) {
  const [activeTab, setActiveTab] = useState<"solicitacoes" | "recebimentos" | "previsoes">("solicitacoes");

  // Filtros de Solicitações
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroAdmin, setFiltroAdmin] = useState("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroMes, setFiltroMes] = useState("");

  // Modais de Solicitação
  const [isNovaSolicitacaoOpen, setIsNovaSolicitacaoOpen] = useState(false);
  const [detalheItem, setDetalheItem] = useState<SolicitacaoRepasseItem | null>(null);
  const [recebimentoModalItem, setRecebimentoModalItem] = useState<SolicitacaoRepasseItem | null>(null);

  // Estados dos formulários
  const [pedidosRawInput, setPedidosRawInput] = useState("");
  const [valorSolicitadoInput, setValorSolicitadoInput] = useState("");
  const [valorNfInput, setValorNfInput] = useState("");

  // Ações
  const [stateCreate, actionCreate, isPendingCreate] = useActionState(criarSolicitacaoRepasseAction, initialSolic);
  const [stateStatus, actionStatus, isPendingStatus] = useActionState(alterarStatusSolicitacaoAction, initialSolic);
  const [stateReceive, actionReceive, isPendingReceive] = useActionState(
    registrarRecebimentoSolicitacaoAction,
    initialReceipt
  );

  const [, startTransition] = useTransition();

  // Filtragem de Solicitações
  const solicitacoesFiltradas = solicitacoes.filter((s) => {
    const termo = filtroBusca.toLowerCase().trim();
    const matchBusca =
      !termo ||
      s.codigo_solicitacao.toLowerCase().includes(termo) ||
      (s.numero_nota_fiscal && s.numero_nota_fiscal.toLowerCase().includes(termo)) ||
      (s.administradora?.nome && s.administradora.nome.toLowerCase().includes(termo)) ||
      (s.pedidos && s.pedidos.some((p) => p.numero_pedido.toLowerCase().includes(termo)));

    const matchAdmin = filtroAdmin === "TODOS" || s.administradora_id === filtroAdmin;
    const matchStatus = filtroStatus === "TODOS" || s.status === filtroStatus;
    const matchMes = !filtroMes || s.mes_referencia === filtroMes;

    return matchBusca && matchAdmin && matchStatus && matchMes;
  });

  // KPIs de Solicitações
  const mesAtual = new Date().toISOString().slice(0, 7);
  const solicitadoNoMes = solicitacoes
    .filter((s) => s.mes_referencia === mesAtual && s.status !== "CANCELADO" && s.status !== "RECUSADO")
    .reduce((acc, s) => acc + Number(s.valor_solicitado), 0);

  const emAnaliseTotal = solicitacoes
    .filter((s) => ["SOLICITADO", "EM_ANALISE"].includes(s.status))
    .reduce((acc, s) => acc + Number(s.valor_solicitado), 0);

  const aguardandoRecebimentoTotal = solicitacoes
    .filter((s) => ["APROVADO", "AGUARDANDO_RECEBIMENTO"].includes(s.status))
    .reduce((acc, s) => acc + Number(s.valor_nota_fiscal || s.valor_solicitado), 0);

  const recebidoTotal = solicitacoes
    .filter((s) => s.status === "RECEBIDO")
    .reduce((acc, s) => acc + Number(s.valor_nota_fiscal || s.valor_solicitado), 0);

  const correcaoQtd = solicitacoes.filter((s) => s.status === "CORRECAO_SOLICITADA").length;

  const handleVisualizarArquivo = async (url: string | null) => {
    if (!url) return;
    const signedUrl = await obterUrlDocumentoRepasseAction(url);
    if (signedUrl) {
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } else {
      alert("Não foi possível carregar o documento com segurança.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Abas de Navegação */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("solicitacoes")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-all ${activeTab === "solicitacoes" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
        >
          <span>📋 Solicitações de Repasse</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-extrabold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            {solicitacoes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recebimentos")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-all ${activeTab === "recebimentos" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
        >
          <span>💵 Recebimentos da Administradora</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {recebimentos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("previsoes")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-all ${activeTab === "previsoes" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
        >
          <span>📈 Previsões & Comissões</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {previsoes.length}
          </span>
        </button>
      </div>

      {/* Feedbacks de Mensagens */}
      {[stateCreate, stateStatus, stateReceive].map((st, idx) =>
        st.message ? (
          <p
            key={idx}
            role="status"
            className={`rounded-lg p-3 text-xs font-bold ${st.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"}`}
          >
            {st.message}
          </p>
        ) : null
      )}

      {/* ABA 1: SOLICITAÇÕES DE REPASSE (FLUXO A) */}
      {activeTab === "solicitacoes" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Solicitações de Repasse às Administradoras
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhamento formal de faturamento, pedidos em lote, Nota Fiscal e liquidação em 1-clique no Caixa.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPedidosRawInput("");
                setValorSolicitadoInput("");
                setValorNfInput("");
                setIsNovaSolicitacaoOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition"
            >
              <span>+</span>
              <span>Nova solicitação de repasse</span>
            </button>
          </div>

          {/* Cards de Resumo */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
            <article className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="font-bold uppercase text-slate-500">Solicitado no Mês</p>
              <p className="mt-1.5 text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                {money(solicitadoNoMes)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Ref: {formatarMesReferencia(mesAtual)}</p>
            </article>

            <article className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
              <p className="font-bold uppercase text-blue-700 dark:text-blue-300">Em Análise</p>
              <p className="mt-1.5 text-xl font-extrabold text-blue-800 dark:text-blue-200 font-mono">
                {money(emAnaliseTotal)}
              </p>
              <p className="text-[10px] text-blue-600/70 dark:text-blue-400 mt-0.5">Aguardando aprovação</p>
            </article>

            <article className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="font-bold uppercase text-amber-700 dark:text-amber-300">Aguardando Recebimento</p>
              <p className="mt-1.5 text-xl font-extrabold text-amber-800 dark:text-amber-200 font-mono">
                {money(aguardandoRecebimentoTotal)}
              </p>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400 mt-0.5">Aprovadas / Com NF</p>
            </article>

            <article className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="font-bold uppercase text-emerald-700 dark:text-emerald-300">Recebido</p>
              <p className="mt-1.5 text-xl font-extrabold text-emerald-800 dark:text-emerald-200 font-mono">
                {money(recebidoTotal)}
              </p>
              <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400 mt-0.5">Liquidado no Caixa</p>
            </article>

            <article className="rounded-xl border border-orange-200 bg-orange-50/40 p-3.5 shadow-sm dark:border-orange-900/40 dark:bg-orange-950/20">
              <p className="font-bold uppercase text-orange-700 dark:text-orange-300">Correção Solicitada</p>
              <p className="mt-1.5 text-xl font-extrabold text-orange-800 dark:text-orange-200 font-mono">
                {correcaoQtd} {correcaoQtd === 1 ? "solicitação" : "solicitações"}
              </p>
              <p className="text-[10px] text-orange-600/70 dark:text-orange-400 mt-0.5">Exige ajuste de dados/NF</p>
            </article>
          </section>

          {/* Filtros */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-xs">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Buscar Solicitação:</label>
                <input
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  placeholder="Código, NF, administradora ou pedido..."
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Mês de Referência:</label>
                <input
                  type="month"
                  value={filtroMes}
                  onChange={(e) => setFiltroMes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Administradora:</label>
                <select
                  value={filtroAdmin}
                  onChange={(e) => setFiltroAdmin(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="TODOS">Todas as Administradoras</option>
                  {administradoras.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Status:</label>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="TODOS">Todos os Status</option>
                  {Object.entries(STATUS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tabela de Solicitações Compacta */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="p-3">Solicitação</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Referência</th>
                    <th className="p-3">Administradora</th>
                    <th className="p-3 text-center">Pedidos</th>
                    <th className="p-3 text-right">Solicitado</th>
                    <th className="p-3">NF</th>
                    <th className="p-3">Data NF</th>
                    <th className="p-3 text-right">Valor NF</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {solicitacoesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-10 text-center text-slate-500">
                        <p className="font-bold text-slate-700 dark:text-slate-300">
                          Nenhuma solicitação de repasse encontrada.
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Crie uma nova solicitação para formalizar pedidos e notas fiscais enviados à administradora.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsNovaSolicitacaoOpen(true)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-800 transition"
                        >
                          + Nova solicitação
                        </button>
                      </td>
                    </tr>
                  ) : (
                    solicitacoesFiltradas.map((s) => {
                      const div = verificarDivergenciaValores(s.valor_solicitado, s.valor_nota_fiscal);
                      const stColor = STATUS_COLORS[s.status] || STATUS_COLORS.RASCUNHO;
                      const podeReceber = isElegivelParaRecebimento(s.status, s.recebimento_id);

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400">
                            {s.codigo_solicitacao}
                          </td>
                          <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            {s.data_solicitacao}
                          </td>
                          <td className="p-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                            {formatarMesReferencia(s.mes_referencia)}
                          </td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-white">
                            {s.administradora?.nome ?? "—"}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {s.pedidos?.length || 0}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            {money(Number(s.valor_solicitado))}
                          </td>
                          <td className="p-3">
                            {s.numero_nota_fiscal ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold">{s.numero_nota_fiscal}</span>
                                {s.arquivo_nf_url && (
                                  <button
                                    type="button"
                                    onClick={() => handleVisualizarArquivo(s.arquivo_nf_url)}
                                    title="Visualizar documento da NF"
                                    className="text-blue-600 hover:text-blue-800 text-[11px] font-bold"
                                  >
                                    [PDF]
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                            {s.data_nota_fiscal || "—"}
                          </td>
                          <td className="p-3 text-right font-mono">
                            {s.valor_nota_fiscal ? (
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {money(Number(s.valor_nota_fiscal))}
                                </span>
                                {div.divergente && (
                                  <span
                                    title={`Divergência de R$ ${div.diferenca.toFixed(2)} em relação ao solicitado`}
                                    className="block text-[10px] font-bold text-amber-600 dark:text-amber-400"
                                  >
                                    ⚠️ Dif: {money(Math.abs(div.diferenca))}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${stColor.bg} ${stColor.text} ${stColor.border}`}
                            >
                              {STATUS_LABELS[s.status] || s.status}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetalheItem(s)}
                                className="rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                              >
                                Abrir
                              </button>

                              {podeReceber && (
                                <button
                                  type="button"
                                  onClick={() => setRecebimentoModalItem(s)}
                                  className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                                >
                                  Registrar recebimento
                                </button>
                              )}

                              {s.status === "RASCUNHO" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fd = new FormData();
                                    fd.append("solicitacao_id", s.id);
                                    fd.append("status", "SOLICITADO");
                                    fd.append("motivo", "Solicitação enviada para a administradora.");
                                    startTransition(async () => {
                                      await actionStatus(fd);
                                    });
                                  }}
                                  className="rounded bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
                                >
                                  Enviar
                                </button>
                              )}

                              {s.recebimento_id && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab("recebimentos")}
                                  className="text-[11px] font-bold text-emerald-700 hover:underline"
                                >
                                  Ver recebimento
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: RECEBIMENTOS DA ADMINISTRADORA (FLUXO B & CONCILIAÇÃO) */}
      {activeTab === "recebimentos" && (
        <div className="space-y-4">
          <ReceiptManager
            administradoras={administradoras}
            contas={contas}
            recebimentos={recebimentos}
            previsoes={previsoes}
          />
        </div>
      )}

      {/* ABA 3: PREVISÕES & COMISSÕES */}
      {activeTab === "previsoes" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Previsões de Comissão da Franquia & Participantes
          </h3>
          <p className="text-slate-500">
            Consulte a programação temporal de comissões por venda e administradora.
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Administradora</th>
                  <th className="p-3">Competência</th>
                  <th className="p-3 text-right">Valor Previsto</th>
                  <th className="p-3 text-right">Valor Liquidado</th>
                  <th className="p-3 text-right">Saldo a Receber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previsoes.map((p) => {
                  const saldo = Number(p.valor_previsto) - Number(p.valor_liquidado);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-semibold">{p.administradora?.nome ?? "—"}</td>
                      <td className="p-3 font-mono">{formatarMesReferencia(p.competencia)}</td>
                      <td className="p-3 text-right font-mono font-bold">{money(Number(p.valor_previsto))}</td>
                      <td className="p-3 text-right font-mono text-emerald-700">{money(Number(p.valor_liquidado))}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700">{money(saldo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NOVA SOLICITAÇÃO DE REPASSE */}
      {isNovaSolicitacaoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Nova Solicitação de Repasse
                </h3>
                <p className="text-xs text-slate-500">
                  Preencha os pedidos, administradora e Nota Fiscal para gerar o processo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNovaSolicitacaoOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData) => {
                await actionCreate(formData);
                setIsNovaSolicitacaoOpen(false);
              }}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Administradora *</label>
                  <select
                    name="administradora_id"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Selecione a administradora...</option>
                    {administradoras.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Mês/Ano de Referência *</label>
                  <input
                    type="month"
                    name="mes_referencia"
                    defaultValue={new Date().toISOString().slice(0, 7)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Números dos Pedidos * (Cole em lote ou linha a linha)
                  </label>
                  <span className="text-[11px] font-mono font-bold text-blue-600">
                    {normalizarPedidos(pedidosRawInput).length} pedido(s) identificado(s)
                  </span>
                </div>
                <textarea
                  name="pedidos_raw"
                  value={pedidosRawInput}
                  onChange={(e) => setPedidosRawInput(e.target.value)}
                  rows={3}
                  placeholder={"Exemplo:\n15326\n15331\n15355\n15361"}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {normalizarPedidos(pedidosRawInput).map((p, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    >
                      #{p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Valor Total Solicitado (R$) *
                  </label>
                  <input
                    name="valor_solicitado"
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={valorSolicitadoInput}
                    onChange={(e) => setValorSolicitadoInput(e.target.value)}
                    required
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Upload do Lote de Pedidos (PDF, JPG, PNG)
                  </label>
                  <input
                    type="file"
                    name="arquivo_pedidos"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50 space-y-3">
                <p className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                  Dados da Nota Fiscal (Opcional no momento da criação)
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Número da NF</label>
                    <input
                      name="numero_nota_fiscal"
                      placeholder="Ex: 1258"
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 bg-white dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Data da NF</label>
                    <input
                      type="date"
                      name="data_nota_fiscal"
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 bg-white dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Valor da NF (R$)</label>
                    <input
                      name="valor_nota_fiscal"
                      type="number"
                      step="0.01"
                      min={0}
                      value={valorNfInput}
                      onChange={(e) => setValorNfInput(e.target.value)}
                      placeholder="0.00"
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 bg-white font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Upload do Arquivo da NF (PDF, JPG, PNG)
                  </label>
                  <input
                    type="file"
                    name="arquivo_nf"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 bg-white file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Observações</label>
                <textarea
                  name="observacao"
                  rows={2}
                  placeholder="Informações adicionais para acompanhamento deste repasse..."
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNovaSolicitacaoOpen(false)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  name="status"
                  value="RASCUNHO"
                  disabled={isPendingCreate}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                >
                  Salvar Rascunho
                </button>

                <button
                  type="submit"
                  name="status"
                  value="SOLICITADO"
                  disabled={isPendingCreate}
                  className="rounded-xl bg-blue-700 px-5 py-2 font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {isPendingCreate ? "Enviando..." : "Enviar Solicitação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DA SOLICITAÇÃO (HISTÓRICO, PEDIDOS & AÇÃO) */}
      {detalheItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold font-mono text-blue-700 dark:text-blue-400">
                    {detalheItem.codigo_solicitacao}
                  </h3>
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${STATUS_COLORS[detalheItem.status]?.bg || ""} ${STATUS_COLORS[detalheItem.status]?.text || ""}`}
                  >
                    {STATUS_LABELS[detalheItem.status] || detalheItem.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Administradora: <strong>{detalheItem.administradora?.nome}</strong> | Referência:{" "}
                  <strong>{formatarMesReferencia(detalheItem.mes_referencia)}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetalheItem(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quadro de Valores */}
            <div className="grid gap-3 sm:grid-cols-3 font-mono">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Valor Solicitado</span>
                <strong className="text-sm text-slate-900 dark:text-white">
                  {money(Number(detalheItem.valor_solicitado))}
                </strong>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Valor da Nota Fiscal</span>
                <strong className="text-sm text-slate-900 dark:text-white">
                  {detalheItem.valor_nota_fiscal ? money(Number(detalheItem.valor_nota_fiscal)) : "Não informado"}
                </strong>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <span className="text-emerald-700 block text-[10px] uppercase font-bold">Valor Recebido</span>
                <strong className="text-sm text-emerald-800 dark:text-emerald-200">
                  {detalheItem.recebimento
                    ? money(Number(detalheItem.recebimento.valor_total))
                    : detalheItem.status === "RECEBIDO"
                    ? money(Number(detalheItem.valor_nota_fiscal || detalheItem.valor_solicitado))
                    : "Pendente"}
                </strong>
              </div>
            </div>

            {/* Nota Fiscal */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                  Documento da Nota Fiscal
                </p>
                {detalheItem.arquivo_nf_url && (
                  <button
                    type="button"
                    onClick={() => handleVisualizarArquivo(detalheItem.arquivo_nf_url)}
                    className="font-bold text-blue-600 hover:underline text-xs"
                  >
                    Visualizar NF ↗
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Número:</span>
                  <strong>{detalheItem.numero_nota_fiscal || "—"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Data da NF:</span>
                  <strong>{detalheItem.data_nota_fiscal || "—"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Arquivo:</span>
                  <span className="truncate block font-mono text-[11px]">
                    {detalheItem.arquivo_nf_nome || (detalheItem.arquivo_nf_url ? "Arquivo anexado" : "Nenhum")}
                  </span>
                </div>
              </div>
            </div>

            {/* Pedidos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                  Pedidos Vinculados ({detalheItem.pedidos?.length || 0})
                </p>
                {detalheItem.arquivo_pedidos_url && (
                  <button
                    type="button"
                    onClick={() => handleVisualizarArquivo(detalheItem.arquivo_pedidos_url)}
                    className="font-bold text-blue-600 hover:underline text-xs"
                  >
                    Visualizar Documento dos Pedidos ↗
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
                {detalheItem.pedidos && detalheItem.pedidos.length > 0 ? (
                  detalheItem.pedidos.map((p) => (
                    <span
                      key={p.id}
                      className="rounded bg-white border border-slate-200 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                    >
                      Pedido #{p.numero_pedido}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">Nenhum pedido listado.</span>
                )}
              </div>
            </div>

            {/* Histórico / Timeline */}
            <div className="space-y-2">
              <p className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                Linha do Tempo & Auditoria
              </p>
              <div className="space-y-2 max-h-36 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/20">
                {detalheItem.historico && detalheItem.historico.length > 0 ? (
                  detalheItem.historico.map((h) => (
                    <div key={h.id} className="text-[11px] border-b border-slate-200/60 pb-1.5 last:border-0">
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                        <span className="font-bold uppercase text-slate-600 dark:text-slate-400">{h.acao}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5">{h.motivo || "Ação registrada."}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-center py-2">Nenhum histórico registrado.</p>
                )}
              </div>
            </div>

            {/* Ações do Rodapé */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {detalheItem.status !== "RECEBIDO" && detalheItem.status !== "CANCELADO" && (
                  <form
                    action={async (fd) => {
                      await actionStatus(fd);
                      setDetalheItem(null);
                    }}
                  >
                    <input type="hidden" name="solicitacao_id" value={detalheItem.id} />
                    <select
                      name="status"
                      defaultValue={detalheItem.status}
                      className="rounded-lg border border-slate-300 p-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="SOLICITADO">Solicitado</option>
                      <option value="EM_ANALISE">Em Análise</option>
                      <option value="APROVADO">Aprovado</option>
                      <option value="AGUARDANDO_RECEBIMENTO">Aguardando Recebimento</option>
                      <option value="CORRECAO_SOLICITADA">Correção Solicitada</option>
                      <option value="RECUSADO">Recusado</option>
                      <option value="CANCELADO">Cancelar Solicitação</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isPendingStatus}
                      className="ml-2 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
                    >
                      Atualizar Status
                    </button>
                  </form>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetalheItem(null)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Fechar
                </button>

                {isElegivelParaRecebimento(detalheItem.status, detalheItem.recebimento_id) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecebimentoModalItem(detalheItem);
                      setDetalheItem(null);
                    }}
                    className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 transition"
                  >
                    Registrar Recebimento no Caixa
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR RECEBIMENTO EM 1-CLIQUE (MOTOR CANÔNICO) */}
      {recebimentoModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Registrar Recebimento Financeiro
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Solicitação {recebimentoModalItem.codigo_solicitacao} — {recebimentoModalItem.administradora?.nome}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecebimentoModalItem(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quadro Informativo de Valores e Divergência */}
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3.5 dark:border-cyan-900/40 dark:bg-cyan-950/20 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Valor Solicitado:</span>
                  <strong>{money(Number(recebimentoModalItem.valor_solicitado))}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Valor da NF:</span>
                  <strong>
                    {recebimentoModalItem.valor_nota_fiscal
                      ? money(Number(recebimentoModalItem.valor_nota_fiscal))
                      : "Sem NF"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Competência:</span>
                  <strong>{formatarMesReferencia(recebimentoModalItem.mes_referencia)}</strong>
                </div>
              </div>
            </div>

            <form
              action={async (formData) => {
                await actionReceive(formData);
                setRecebimentoModalItem(null);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="solicitacao_id" value={recebimentoModalItem.id} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Data Efetiva do Recebimento *
                  </label>
                  <input
                    type="date"
                    name="data_recebimento"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Valor a Registrar no Caixa (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    name="valor_recebido"
                    defaultValue={calcularValorSugeridoRecebimento(
                      recebimentoModalItem.valor_solicitado,
                      recebimentoModalItem.valor_nota_fiscal
                    )}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold font-mono text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-400"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Conta Bancária</label>
                  <select
                    name="conta_bancaria_id"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Caixa geral (Sem conta específica)</option>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Conta/Caixa de Entrada *</label>
                  <input
                    name="conta_entrada"
                    defaultValue="Caixa geral"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Descrição do Lançamento</label>
                <input
                  name="descricao"
                  defaultValue={`Recebimento via Solicitação ${recebimentoModalItem.codigo_solicitacao}`}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Observações</label>
                <textarea
                  name="observacoes"
                  rows={2}
                  placeholder="Informações adicionais sobre o recebimento..."
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRecebimentoModalItem(null)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingReceive}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isPendingReceive ? "Registrando no Caixa..." : "Confirmar Recebimento Real"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}