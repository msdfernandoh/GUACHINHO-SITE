"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Link2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Building2,
  Layers,
  History,
  Check,
  AlertCircle,
  Globe,
  Sparkles,
  ExternalLink
} from "lucide-react";
import {
  vincularGrupoLegadoAction,
  atualizarVisualizacaoCatalogoAction
} from "@/app/platform/grupos/vinculacoes/actions";
import type {
  GrupoLegadoItem,
  HistoricoVinculacao,
  ProdutoMapeado
} from "@/lib/platform/vinculacoes-legadas-service";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function VinculacoesLegadasView({
  empresaId,
  itens,
  historico,
  totalPendentes,
  totalSugestoes,
  gruposSaasDisponiveis
}: {
  empresaId: string;
  itens: GrupoLegadoItem[];
  historico: HistoricoVinculacao[];
  totalPendentes: number;
  totalSugestoes: number;
  gruposSaasDisponiveis: {
    id: string;
    codigo_grupo: string;
    administradora_nome: string;
    tipo_nome: string | null;
    modalidade_nome: string | null;
    prazo_total: number | null;
    status: string;
    ativo: boolean;
    cota_min?: number;
    cota_max?: number;
    cotas: {
      id: string;
      valor_credito: number;
    }[];
  }[];
}) {
  const [activeTab, setActiveTab] = useState<"catalogo_saas" | "legados" | "historico">("catalogo_saas");
  const [modalItem, setModalItem] = useState<GrupoLegadoItem | null>(null);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();
  const [syncFeedback, setSyncFeedback] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(null);

  function abrirModal(item: GrupoLegadoItem) {
    setModalItem(item);
    setSelectedGrupoId(item.grupo_saas_sugerido?.id || item.candidatos_grupos_saas[0]?.id || "");
    setObservacoes("");
    setFeedback(null);
  }

  function fecharModal() {
    setModalItem(null);
    setSelectedGrupoId("");
    setObservacoes("");
  }

  const grupoSelecionadoObj = gruposSaasDisponiveis.find((g) => g.id === selectedGrupoId);
  const mapeamentoAtual: ProdutoMapeado[] = modalItem
    ? modalItem.creditos.map((cred) => {
        const matches = (grupoSelecionadoObj?.cotas ?? []).filter((c) => Math.abs(c.valor_credito - cred) < 0.01);
        if (matches.length === 1) {
          return {
            valor_credito: cred,
            grupo_cota_id: matches[0].id,
            status_produto: "ENCONTRADO"
          };
        }
        if (matches.length > 1) {
          return {
            valor_credito: cred,
            grupo_cota_id: null,
            status_produto: "AMBIGUO_NO_SAAS" as const,
          };
        }
        return {
          valor_credito: cred,
          grupo_cota_id: null,
          status_produto: "NAO_ENCONTRADO_NO_SAAS"
        };
      })
    : [];

  const temProdutoPendente = mapeamentoAtual.some((m) => m.status_produto !== "ENCONTRADO");

  function handleAtualizarVisualizacao() {
    startSyncTransition(async () => {
      const res = await atualizarVisualizacaoCatalogoAction();
      if (res.ok) {
        setSyncFeedback({
          tipo: "sucesso",
          msg: res.mensagem || "Visualização atualizada com os dados do catálogo SaaS."
        });
      } else {
        setSyncFeedback({
          tipo: "erro",
          msg: res.error || "Erro ao atualizar a visualização do catálogo."
        });
      }
      setTimeout(() => setSyncFeedback(null), 5000);
    });
  }

  async function handleConfirmarVinculo() {
    if (!modalItem || !selectedGrupoId) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("empresa_id", empresaId);
      formData.set("origem", modalItem.origem);
      formData.set("identificador_legado", modalItem.identificador);
      formData.set("grupo_consorcio_id", selectedGrupoId);
      formData.set("produtos_mapeamento", JSON.stringify(mapeamentoAtual));
      formData.set("observacoes", observacoes);

      const res = await vincularGrupoLegadoAction(formData);
      if (res.ok) {
        setFeedback({
          tipo: "sucesso",
          msg: `Vínculo realizado com sucesso! ${(res.data as any)?.contratacoes_afetadas || 0} contratações sincronizadas com o Grupo SaaS.`
        });
        setTimeout(() => {
          fecharModal();
        }, 1200);
      } else {
        setFeedback({
          tipo: "erro",
          msg: res.error || "Erro ao efetivar vinculação."
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/platform/grupos"
              className="text-xs font-bold uppercase tracking-wider text-cyan-700 hover:underline dark:text-cyan-400"
            >
              ← Voltar ao Catálogo de Grupos
            </Link>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Globe className="text-cyan-600" size={30} />
            Publicação e Vinculação de Grupos (Site & ERP)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            O Site e o ERP leem o catálogo canônico do SaaS. Use esta tela para conferir vínculos e recarregar os dados já cadastrados; integrações externas serão identificadas separadamente quando estiverem disponíveis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleAtualizarVisualizacao}
            disabled={isSyncing}
            title="Recarrega os dados já cadastrados no catálogo SaaS. Não consulta API externa."
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Atualizando..." : "Atualizar visualização"}
          </button>
          <Link
            href="/grupos"
            target="_blank"
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <ExternalLink size={15} /> Ver no Site Público
          </Link>
        </div>
      </div>

      {/* FEEDBACK DE ATUALIZAÇÃO DE CACHE/VISUALIZAÇÃO */}
      {syncFeedback && (
        <div
          className={`rounded-2xl p-4 text-xs font-bold flex items-center gap-3 shadow-sm ${
            syncFeedback.tipo === "sucesso"
              ? "bg-emerald-50 text-emerald-950 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-rose-50 text-rose-950 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          {syncFeedback.tipo === "sucesso" ? (
            <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle size={20} className="shrink-0 text-rose-600" />
          )}
          <span>{syncFeedback.msg}</span>
        </div>
      )}

      {/* STATS CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-5 shadow-sm dark:border-cyan-900/40 dark:bg-cyan-950/20">
          <div className="flex items-center justify-between text-cyan-800 dark:text-cyan-300">
            <span className="text-xs font-bold uppercase tracking-wider">Grupos no SaaS</span>
            <Layers size={18} className="text-cyan-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-cyan-900 dark:text-cyan-100">{gruposSaasDisponiveis.length}</p>
          <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-400">Catálogo canônico oficial</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
            <span className="text-xs font-bold uppercase tracking-wider">Publicados no Site</span>
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-100">
            {gruposSaasDisponiveis.filter((g) => g.cotas.length > 0 && g.ativo).length}
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Com cotas e concessão ativa</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
            <span className="text-xs font-bold uppercase tracking-wider">Origens Legadas</span>
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">{itens.length}</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Contratações antigas mapeadas</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex items-center justify-between text-blue-800 dark:text-blue-300">
            <span className="text-xs font-bold uppercase tracking-wider">Auditorias Registradas</span>
            <History size={18} className="text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-blue-900 dark:text-blue-100">{historico.length}</p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">Histórico de vinculações</p>
        </div>
      </div>

      {/* TABS NAVEGAÇÃO */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab("catalogo_saas")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "catalogo_saas"
              ? "border-cyan-600 text-cyan-700 dark:text-cyan-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Globe size={16} />
          Catálogo SaaS & Publicação no Site e ERP ({gruposSaasDisponiveis.length})
        </button>

        <button
          onClick={() => setActiveTab("legados")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "legados"
              ? "border-cyan-600 text-cyan-700 dark:text-cyan-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Link2 size={16} />
          Resolução de Contratações e Nomes Legados ({itens.length})
        </button>

        <button
          onClick={() => setActiveTab("historico")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "historico"
              ? "border-cyan-600 text-cyan-700 dark:text-cyan-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <History size={16} />
          Histórico de Auditoria ({historico.length})
        </button>
      </div>

      {/* ABA 1: CATÁLOGO SAAS COMPLETO & STATUS DE PUBLICAÇÃO */}
      {activeTab === "catalogo_saas" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Grupos Oficiais do SaaS e Status no Site & ERP
              </h2>
              <p className="text-xs text-slate-500">
                Todos os grupos cadastrados no SaaS que possuem produtos/cotas ativas e concessão da Administradora já são veiculados automaticamente no Site e no ERP.
              </p>
            </div>
            <Link
              href="/platform/grupos/novo"
              className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-800"
            >
              + Novo Grupo Global
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Grupo</th>
                  <th className="p-3">Administradora</th>
                  <th className="p-3">Tipo / Segmento</th>
                  <th className="p-3">Modalidade</th>
                  <th className="p-3 text-center">Prazo Total</th>
                  <th className="p-3 text-center">Produtos / Cotas</th>
                  <th className="p-3 text-center">Status no SaaS</th>
                  <th className="p-3 text-center">Publicação no Site & ERP</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gruposSaasDisponiveis.map((g) => {
                  const temCotas = g.cotas.length > 0;
                  const isPublicado = temCotas && g.ativo && g.status !== "Inativo";

                  return (
                    <tr key={g.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                        {g.codigo_grupo}
                      </td>
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                        {g.administradora_nome}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          {g.tipo_nome || "Imóvel"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">
                        {g.modalidade_nome || "Padrão"}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold">
                        {g.prazo_total || "—"}m
                      </td>
                      <td className="p-3 text-center">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {g.cotas.length} cotas cadastradas
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            g.ativo && g.status !== "Inativo"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {g.status || (g.ativo ? "Disponível" : "Inativo")}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isPublicado ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 size={12} /> Publicado no Site & ERP
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300" title="Cadastre cotas para exibir ao público">
                            <AlertTriangle size={12} /> Aguardando Cotas
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <Link
                          href={`/platform/grupos/${g.id}`}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                        >
                          Abrir / Editar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 2: RESOLUÇÃO DE IDENTIFICADORES LEGADOS */}
      {activeTab === "legados" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Identificadores e Grupos Legados de Contratações Anteriores
            </h2>
            <p className="text-xs text-slate-500">
              Contratações criadas antes da padronização canônica que possuíam nomes textuais. Vincule de forma assistida para atualizar o histórico sem duplicar dados.
            </p>
          </div>

          {itens.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              Nenhuma contratação com identificador legado pendente encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="p-3">Identificador Legado</th>
                    <th className="p-3">Origem</th>
                    <th className="p-3">Administradora</th>
                    <th className="p-3">Tipo / Bem</th>
                    <th className="p-3 text-center">Contratações</th>
                    <th className="p-3">Créditos Detectados</th>
                    <th className="p-3">Grupo SaaS Sugerido</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {itens.map((item) => (
                    <tr key={item.identificador} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                        {item.identificador}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium dark:bg-slate-800">
                          {item.origem}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                        {item.administradora || "—"}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {item.tipo_bem || "—"}
                      </td>
                      <td className="p-3 text-center font-bold text-blue-700 dark:text-blue-400">
                        {item.total_contratacoes}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {item.creditos.map((c) => (
                            <span
                              key={c}
                              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {money.format(c)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        {item.grupo_saas_sugerido ? (
                          <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                            Grupo {item.grupo_saas_sugerido.codigo_grupo} ({item.grupo_saas_sugerido.administradora_nome})
                          </div>
                        ) : (
                          <span className="text-slate-400">Seleção manual necessária</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            item.status_vinculo === "VINCULADO"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : item.status_vinculo === "SUGESTAO_INELUDIVEL"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {item.status_vinculo === "VINCULADO"
                            ? "Vinculado"
                            : item.status_vinculo === "SUGESTAO_INELUDIVEL"
                            ? "Sugestão Pronta"
                            : "Pendente"}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => abrirModal(item)}
                          className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-800"
                        >
                          {item.status_vinculo === "VINCULADO" ? "Revisar Vínculo" : "Vincular ao SaaS"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: HISTÓRICO DE AUDITORIA */}
      {activeTab === "historico" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" size={20} />
            Histórico de Vinculações Auditadas
          </h2>
          {historico.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhum evento de vinculação manual auditado registrado até o momento.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {historico.map((h) => (
                <div key={h.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Identificador: <span className="font-mono">{h.identificador_legado}</span> ➔ Grupo SaaS:{" "}
                      <span className="font-bold text-cyan-700 dark:text-cyan-400">
                        {h.grupo?.codigo_grupo} ({h.grupo?.administradora?.nome || "Administradora"})
                      </span>
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      Origem: {h.origem} · Contratações sincronizadas: {h.contratacoes_afetadas}
                      {h.observacoes ? ` · Obs: ${h.observacoes}` : ""}
                    </p>
                  </div>
                  <time className="text-slate-400 font-mono">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </time>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO E MAPEAMENTO */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-600">Confirmação de Vínculo Canônico</p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Mapear Grupo Legado ➔ Grupo SaaS
                </h2>
              </div>
              <button
                onClick={fecharModal}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {feedback && (
              <div
                className={`rounded-xl p-4 text-xs font-semibold flex items-center gap-2 ${
                  feedback.tipo === "sucesso"
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
                    : "bg-rose-50 text-rose-900 border border-rose-300"
                }`}
              >
                {feedback.tipo === "sucesso" ? <Check size={16} /> : <AlertCircle size={16} />}
                <span>{feedback.msg}</span>
              </div>
            )}

            {/* SELEÇÃO DO GRUPO SAAS */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                Grupo SaaS Canônico de Destino
              </label>
              <select
                value={selectedGrupoId}
                onChange={(e) => setSelectedGrupoId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Selecione o Grupo SaaS correspondente</option>
                {gruposSaasDisponiveis.map((g) => (
                  <option key={g.id} value={g.id}>
                    Grupo {g.codigo_grupo} · {g.administradora_nome} · {g.tipo_nome || "Tipo"} · {g.modalidade_nome || "Modalidade"} ({g.cotas.length} cotas)
                  </option>
                ))}
              </select>
            </div>

            {/* MAPEAMENTO DE PRODUTOS / COTAS */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                Mapeamento dos Produtos / Cotas por Crédito
              </h3>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-left text-slate-500 uppercase">
                    <tr>
                      <th className="p-2.5">Crédito Legado</th>
                      <th className="p-2.5">➔ Produto Cota SaaS</th>
                      <th className="p-2.5">Parcela / Prazo</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {mapeamentoAtual.map((m) => (
                      <tr key={m.valor_credito}>
                        <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">
                          {money.format(m.valor_credito)}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">
                          {m.grupo_cota_id ? `ID: ${m.grupo_cota_id.slice(0, 8)}...` : "—"}
                        </td>
                        <td className="p-2.5 text-slate-700 dark:text-slate-300">
                          {m.grupo_cota_id ? `Produto ${m.grupo_cota_id.slice(0, 8)}…` : m.status_produto === "AMBIGUO_NO_SAAS" ? "Crédito duplicado no catálogo" : "—"}
                        </td>
                        <td className="p-2.5 text-center">
                          {m.status_produto === "ENCONTRADO" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <Check size={11} /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <AlertTriangle size={11} /> Ausente no Grupo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {temProdutoPendente && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  ⚠️ Atenção: Há produtos de crédito do grupo legado que não estão cadastrados no Grupo SaaS selecionado. Eles não serão criados silenciosamente.
                </p>
              )}
            </div>

            {/* OBSERVAÇÃO DE AUDITORIA */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                Observação de Auditoria (Opcional)
              </label>
              <input
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Vinculação confirmada da contratação do site para o Grupo oficial Racon 1463."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={fecharModal}
                disabled={isPending}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarVinculo}
                disabled={!selectedGrupoId || isPending}
                className="rounded-xl bg-cyan-700 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800 disabled:opacity-50 flex items-center gap-2"
              >
                {isPending ? "Processando e Auditando..." : "Confirmar Vínculo com Auditoria"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
