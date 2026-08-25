"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCommissionProfileAction,
  updateCommissionProfileAction,
  toggleCommissionProfileAction,
  saveParticipantProfileRuleAction,
  homologateParticipantProfileRuleAction,
  newVersionParticipantProfileRuleAction,
  toggleParticipantProfileRuleAction,
  deleteParticipantProfileRuleAction,
  linkParticipantePerfilAction,
  unlinkParticipantePerfilAction,
  saveFiscalConfigAction,
  homologarRegraPadraoOficialAction,
  updateFranchiseRuleAction,
  deleteFranchiseRuleAction,
  cleanupDuplicateFranchiseRulesAction,
  createFranchiseRuleAction,
  saveCurvaEstornoAction,
  deleteCurvaEstornoAction,
  toggleCurvaEstornoAction,
} from "@/app/erp/regras-comissao/actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export type PerfilRow = {
  id: string;
  nome: string;
  descricao: string | null;
  papel_base: string;
  ativo: boolean;
};

export type RegraFranquiaRow = {
  id: string;
  programa_id: string;
  programa_nome?: string;
  administradora_nome?: string;
  versao: number;
  tipo_administradora_id?: string | null;
  tipo_nome?: string;
  modalidade_comissao_id?: string | null;
  modalidade_nome?: string;
  percentual_total_comissao: number | null;
  valor_fixo_total: number | null;
  base_calculo: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativa: boolean;
  configuracao_homologada: boolean;
  etapas_cronograma: any[];
};

export type RegraPerfilRow = {
  id: string;
  perfil_id: string | null;
  perfil_nome?: string;
  papel_base?: string;
  programa_id: string;
  programa_nome?: string;
  administradora_id?: string | null;
  administradora_nome?: string;
  tipo_administradora_id: string | null;
  tipo_nome?: string;
  modalidade_comissao_id: string | null;
  modalidade_nome?: string;
  base_v2: string;
  percentual_comissao: number | null;
  valor_fixo_total: number | null;
  seguir_cronograma_franquia: boolean;
  aplicar_curva_estorno: boolean;
  curva_estorno_id: string | null;
  curva_nome?: string;
  versao: number;
  status: "RASCUNHO" | "HOMOLOGADA" | "SUBSTITUIDA" | "INATIVA";
  configuracao_homologada: boolean;
  ativa: boolean;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  nome_regra: string | null;
  observacoes: string | null;
};

export type ParticipanteVinculoRow = {
  id: string;
  participante_id: string;
  participante_nome: string;
  participante_cpf?: string | null;
  papel_tipo: string;
  perfil_id: string;
  perfil_nome: string;
  override_percentual: number | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean;
  observacoes: string | null;
};

export type CurvaEstornoRow = {
  id: string;
  nome: string;
  descricao: string | null;
  administradora_id: string;
  administradora_nome?: string;
  versao: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativa: boolean;
  encerra_na_contemplacao: boolean;
  faixas: Array<{ mes_relativo: number; percentual_estorno: number }>;
};

export type ParticipanteOption = {
  id: string;
  nome: string;
  tipos: string[];
};

export function ErpCommissionHubView({
  empresaId,
  perfis,
  regrasFranquia,
  regrasPerfis,
  vinculos,
  participantes,
  administradoras,
  programas,
  tipos,
  modalidades,
  curvasEstorno,
  fiscais,
  canWrite,
}: {
  empresaId: string;
  perfis: PerfilRow[];
  regrasFranquia: RegraFranquiaRow[];
  regrasPerfis: RegraPerfilRow[];
  vinculos: ParticipanteVinculoRow[];
  participantes: ParticipanteOption[];
  administradoras: Array<{ id: string; nome: string }>;
  programas: Array<{ id: string; nome: string; administradora_id: string | null }>;
  tipos: Array<{ id: string; nome: string; administradora_id: string }>;
  modalidades: Array<{ id: string; nome: string; administradora_id: string }>;
  curvasEstorno: CurvaEstornoRow[];
  fiscais: any[];
  canWrite: boolean;
}) {
  const router = useRouter();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"franquia" | "perfis" | "regras" | "participantes" | "curvas" | "fiscal">("regras");

  // Modal: Novo / Editar Perfil
  const [perfilModalOpen, setPerfilModalOpen] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<PerfilRow | null>(null);
  const [isSavingPerfil, setIsSavingPerfil] = useState(false);
  const [perfilError, setPerfilError] = useState<string | null>(null);

  // Modal: Nova / Editar Regra de Perfil
  const [regraModalOpen, setRegraModalOpen] = useState(false);
  const [editingRegra, setEditingRegra] = useState<RegraPerfilRow | null>(null);
  const [isSavingRegra, setIsSavingRegra] = useState(false);
  const [regraError, setRegraError] = useState<string | null>(null);

  // Modal: Editar / Nova Regra da Franqueadora
  const [franchiseModalOpen, setFranchiseModalOpen] = useState(false);
  const [editingFranchiseRule, setEditingFranchiseRule] = useState<RegraFranquiaRow | null>(null);
  const [isSavingFranchiseRule, setIsSavingFranchiseRule] = useState(false);
  const [franchiseError, setFranchiseError] = useState<string | null>(null);

  // Modal: Vincular / Editar Participante ao Perfil
  const [vinculoModalOpen, setVinculoModalOpen] = useState(false);
  const [editingVinculo, setEditingVinculo] = useState<ParticipanteVinculoRow | null>(null);
  const [isSavingVinculo, setIsSavingVinculo] = useState(false);
  const [vinculoError, setVinculoError] = useState<string | null>(null);

  // Modal: Nova / Editar Curva de Estorno
  const [curvaModalOpen, setCurvaModalOpen] = useState(false);
  const [editingCurva, setEditingCurva] = useState<CurvaEstornoRow | null>(null);
  const [isSavingCurva, setIsSavingCurva] = useState(false);
  const [curvaError, setCurvaError] = useState<string | null>(null);
  const [curvaFaixas, setCurvaFaixas] = useState<Array<{ mes: number; percentual: number }>>([
    { mes: 1, percentual: 100 },
    { mes: 2, percentual: 100 },
    { mes: 3, percentual: 100 },
    { mes: 4, percentual: 100 },
    { mes: 5, percentual: 100 },
    { mes: 6, percentual: 100 },
    { mes: 7, percentual: 80 },
    { mes: 12, percentual: 80 },
    { mes: 18, percentual: 50 },
    { mes: 24, percentual: 30 },
  ]);

  // Modal: Alíquota Fiscal
  const [fiscalModalOpen, setFiscalModalOpen] = useState(false);
  const [isSavingFiscal, setIsSavingFiscal] = useState(false);
  const [fiscalError, setFiscalError] = useState<string | null>(null);

  // Feedback global toast / banner
  const [globalFeedback, setGlobalFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Handlers seguros para ações de regras
  const [isProcessingRuleAction, setIsProcessingRuleAction] = useState(false);

  const handleHomologateRule = async (regraId: string) => {
    try {
      setIsProcessingRuleAction(true);
      setGlobalFeedback(null);
      const fd = new FormData();
      fd.set("empresa_id", empresaId);
      fd.set("regra_id", regraId);
      await homologateParticipantProfileRuleAction(fd);
      setGlobalFeedback({ type: "success", message: "Regra homologada com sucesso." });
      router.refresh();
    } catch (err) {
      setGlobalFeedback({ type: "error", message: err instanceof Error ? err.message : "Erro ao homologar regra." });
    } finally {
      setIsProcessingRuleAction(false);
    }
  };

  const handleNewVersionRule = async (regraId: string) => {
    try {
      setIsProcessingRuleAction(true);
      setGlobalFeedback(null);
      const fd = new FormData();
      fd.set("empresa_id", empresaId);
      fd.set("regra_id", regraId);
      await newVersionParticipantProfileRuleAction(fd);
      setGlobalFeedback({ type: "success", message: "Nova versão criada em Rascunho." });
      router.refresh();
    } catch (err) {
      setGlobalFeedback({ type: "error", message: err instanceof Error ? err.message : "Erro ao criar nova versão." });
    } finally {
      setIsProcessingRuleAction(false);
    }
  };

  const handleToggleRule = async (regraId: string, ativo: boolean) => {
    try {
      setIsProcessingRuleAction(true);
      setGlobalFeedback(null);
      const fd = new FormData();
      fd.set("empresa_id", empresaId);
      fd.set("regra_id", regraId);
      fd.set("ativo", String(ativo));
      await toggleParticipantProfileRuleAction(fd);
      setGlobalFeedback({ type: "success", message: `Regra ${ativo ? "ativada" : "inativada"} com sucesso.` });
      router.refresh();
    } catch (err) {
      setGlobalFeedback({ type: "error", message: err instanceof Error ? err.message : "Erro ao alterar status da regra." });
    } finally {
      setIsProcessingRuleAction(false);
    }
  };

  const handleDeleteRule = async (regraId: string) => {
    if (!confirm("Excluir este rascunho de regra?")) return;
    try {
      setIsProcessingRuleAction(true);
      setGlobalFeedback(null);
      const fd = new FormData();
      fd.set("empresa_id", empresaId);
      fd.set("regra_id", regraId);
      await deleteParticipantProfileRuleAction(fd);
      setGlobalFeedback({ type: "success", message: "Regra excluída com sucesso." });
      router.refresh();
    } catch (err) {
      setGlobalFeedback({ type: "error", message: err instanceof Error ? err.message : "Erro ao excluir regra." });
    } finally {
      setIsProcessingRuleAction(false);
    }
  };

  // Filter in Regras tab
  const [selectedPerfilFilter, setSelectedPerfilFilter] = useState<string>("");

  const filteredRegrasPerfis = selectedPerfilFilter
    ? regrasPerfis.filter((r) => r.perfil_id === selectedPerfilFilter)
    : regrasPerfis;

  const handleOpenNewCurva = () => {
    setEditingCurva(null);
    setCurvaFaixas([
      { mes: 1, percentual: 100 },
      { mes: 2, percentual: 100 },
      { mes: 3, percentual: 100 },
      { mes: 6, percentual: 100 },
      { mes: 12, percentual: 80 },
      { mes: 24, percentual: 50 },
    ]);
    setCurvaError(null);
    setCurvaModalOpen(true);
  };

  const handleOpenEditCurva = (c: CurvaEstornoRow) => {
    setEditingCurva(c);
    setCurvaFaixas(
      c.faixas && c.faixas.length > 0
        ? c.faixas.map((f) => ({ mes: f.mes_relativo, percentual: f.percentual_estorno }))
        : [{ mes: 1, percentual: 100 }]
    );
    setCurvaError(null);
    setCurvaModalOpen(true);
  };

  const handleAddFaixa = () => {
    const nextMes = curvaFaixas.length > 0 ? Math.max(...curvaFaixas.map((f) => f.mes)) + 1 : 1;
    setCurvaFaixas([...curvaFaixas, { mes: nextMes, percentual: 50 }]);
  };

  const handleRemoveFaixa = (idx: number) => {
    setCurvaFaixas(curvaFaixas.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO ERP */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Regras de Comissão</h1>
            <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Arquitetura V2
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Administradora → Regra da Franqueadora → Perfis Comerciais → Participantes → Venda
          </p>
        </div>

        {/* Botão de Homologação Rápida */}
        {canWrite && regrasFranquia.length === 0 && (
          <form action={homologarRegraPadraoOficialAction}>
            <input type="hidden" name="empresa_id" value={empresaId} />
            <button className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition">
              ⚡ Ativar Regra Oficial Padrão (4%)
            </button>
          </form>
        )}
      </div>

{globalFeedback && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-xs font-bold ${
            globalFeedback.type === "error"
              ? "border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          }`}
        >
          <span>{globalFeedback.message}</span>
          <button onClick={() => setGlobalFeedback(null)} className="ml-4 text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {/* 2. ABAS DE NAVEGAÇÃO PRINCIPAL */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("regras")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "regras"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <span>📜</span> Regras dos Perfis ({regrasPerfis.length})
        </button>

        <button
          onClick={() => setActiveTab("perfis")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "perfis"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <span>👥</span> Perfis de Comissão ({perfis.length})
        </button>

        <button
          onClick={() => setActiveTab("participantes")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "participantes"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <span>🤝</span> Participantes & Perfis ({vinculos.length})
        </button>

        <button
          onClick={() => setActiveTab("curvas")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "curvas"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <span>🛡️</span> Curvas de Estorno ({curvasEstorno.length})
        </button>

        <button
          onClick={() => setActiveTab("franquia")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "franquia"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <span>🏢</span> Franqueadora ({regrasFranquia.length})
        </button>

        <button
          onClick={() => setActiveTab("fiscal")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "fiscal"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <span>📊</span> Impostos & Fiscal ({fiscais.length})
        </button>
      </div>

      {/* 3. CONTEÚDO DAS ABAS */}

      {/* ABA 1: REGRAS DOS PERFIS */}
      {activeTab === "regras" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Filtrar por Perfil:</label>
              <select
                value={selectedPerfilFilter}
                onChange={(e) => setSelectedPerfilFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Todos os Perfis ({regrasPerfis.length})</option>
                {perfis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({p.papel_base})
                  </option>
                ))}
              </select>
            </div>

            {canWrite && (
              <button
                onClick={() => {
                  setEditingRegra(null);
                  setRegraModalOpen(true);
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                + Nova Regra para Perfil
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="p-3.5">Perfil Comercial</th>
                    <th className="p-3.5">Administradora / Tipo / Modalidade</th>
                    <th className="p-3.5">Base de Cálculo</th>
                    <th className="p-3.5 font-mono">Remuneração</th>
                    <th className="p-3.5">Cronograma & Curva</th>
                    <th className="p-3.5">Vigência</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRegrasPerfis.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <p className="font-semibold">Nenhuma regra cadastrada para este perfil.</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Clique em "+ Nova Regra para Perfil" para configurar o repasse.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRegrasPerfis.map((regra) => {
                      const isHomologada = (regra.status === "HOMOLOGADA" || regra.configuracao_homologada) && regra.status !== "RASCUNHO";
                      const isRascunho = regra.status === "RASCUNHO" || (!regra.configuracao_homologada && regra.status !== "HOMOLOGADA");

                      return (
                        <tr key={regra.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          {/* Perfil */}
                          <td className="p-3.5">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {regra.perfil_nome || "Perfil Geral"}
                            </span>
                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:bg-slate-800">
                              v{regra.versao}
                            </span>
                            {regra.papel_base && (
                              <p className="text-[11px] text-slate-500">{regra.papel_base}</p>
                            )}
                          </td>

                          {/* Escopo */}
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {regra.administradora_nome || "Racon Consórcios"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {regra.tipo_nome || "Todos os Tipos"} · {regra.modalidade_nome || "Todas as Modalidades"}
                            </div>
                          </td>

                          {/* Base */}
                          <td className="p-3.5">
                            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {regra.base_v2 === "COMISSAO_FRANQUEADORA_LIQUIDA"
                                ? "% da Comissão Líquida"
                                : regra.base_v2 === "VALOR_VENDIDO"
                                ? "% do Crédito Vendido"
                                : regra.base_v2 === "VALOR_FIXO"
                                ? "Valor Fixo em R$"
                                : "% da Comissão da Franquia"}
                            </span>
                          </td>

                          {/* Remuneração */}
                          <td className="p-3.5 font-mono font-bold text-blue-700 dark:text-blue-400">
                            {regra.base_v2 === "VALOR_FIXO" && regra.valor_fixo_total
                              ? money.format(regra.valor_fixo_total)
                              : `${regra.percentual_comissao}%`}
                          </td>

                          {/* Cronograma & Curva */}
                          <td className="p-3.5 text-[11px] text-slate-600 dark:text-slate-400">
                            <div>
                              {regra.seguir_cronograma_franquia ? "⚡ Segue Franqueadora" : "📅 Cronograma Próprio"}
                            </div>
                            <div>
                              {regra.aplicar_curva_estorno
                                ? `🛡️ ${regra.curva_nome || "Curva Padrão"}`
                                : "Sem Curva"}
                            </div>
                          </td>

                          {/* Vigência */}
                          <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                            {regra.vigencia_inicio} → {regra.vigencia_fim || "aberta"}
                          </td>

                          {/* Status */}
                          <td className="p-3.5 text-center">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                                isHomologada
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : isRascunho
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              {isHomologada ? "HOMOLOGADA" : isRascunho ? "RASCUNHO" : regra.status}
                            </span>
                          </td>

                          {/* Ações */}
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* RASCUNHO: Editar e Homologar */}
                              {isRascunho && canWrite && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingRegra(regra);
                                      setRegraModalOpen(true);
                                    }}
                                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleHomologateRule(regra.id)}
                                    disabled={isProcessingRuleAction}
                                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                                  >
                                    {isProcessingRuleAction ? "..." : "Homologar"}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRule(regra.id)}
                                    disabled={isProcessingRuleAction}
                                    className="rounded-lg border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 dark:border-rose-900 disabled:opacity-50"
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}

                              {/* HOMOLOGADA: Editar, Nova Versão e Inativar */}
                              {isHomologada && canWrite && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingRegra(regra);
                                      setRegraModalOpen(true);
                                    }}
                                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleNewVersionRule(regra.id)}
                                    disabled={isProcessingRuleAction}
                                    className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 disabled:opacity-50"
                                  >
                                    Nova Versão
                                  </button>
                                  <button
                                    onClick={() => handleToggleRule(regra.id, false)}
                                    disabled={isProcessingRuleAction}
                                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 disabled:opacity-50"
                                  >
                                    Inativar
                                  </button>
                                </>
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
        </section>
      )}

      {/* ABA 2: PERFIS DE COMISSÃO */}
      {activeTab === "perfis" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Perfis Comerciais da Franquia</h2>
              <p className="text-xs text-slate-500">
                Perfis padronizados e reutilizáveis por função (Microfranquia, Consultor, SDR, Indicador, etc.).
              </p>
            </div>
            {canWrite && (
              <button
                onClick={() => {
                  setEditingPerfil(null);
                  setPerfilModalOpen(true);
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                + Novo Perfil
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {perfis.map((perfil) => {
              const regrasCount = regrasPerfis.filter((r) => r.perfil_id === perfil.id).length;
              const vinculosCount = vinculos.filter((v) => v.perfil_id === perfil.id).length;

              return (
                <div
                  key={perfil.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {perfil.papel_base}
                      </span>
                      <h3 className="mt-1 font-bold text-base text-slate-900 dark:text-white">{perfil.nome}</h3>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        perfil.ativo
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                      }`}
                    >
                      {perfil.ativo ? "ATIVO" : "INATIVO"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[32px]">
                    {perfil.descricao || "Sem descrição informada."}
                  </p>

                  <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    <div>
                      <span className="text-[11px] text-slate-400">Regras vinculadas:</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{regrasCount} regra(s)</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400">Participantes:</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{vinculosCount} pessoa(s)</p>
                    </div>
                  </div>

                  {canWrite && (
                    <div className="flex items-center justify-end gap-2 border-t pt-3 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setEditingPerfil(perfil);
                          setPerfilModalOpen(true);
                        }}
                        className="rounded-lg border px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* GUIA OPERACIONAL E EXPLICAÇÃO DA ABA */}
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-6 text-slate-800 shadow-sm dark:border-blue-900/50 dark:from-slate-900 dark:to-blue-950/30 dark:text-slate-200">
            <div className="flex items-center gap-2.5 font-bold text-sm text-blue-900 dark:text-blue-300">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">💡</span>
              <span>Como funcionam os Perfis de Comissão e como configurar:</span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-blue-200/60 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-xs">PASSO 1</span>
                <h4 className="mt-1 font-bold text-xs text-slate-900 dark:text-white">Criar o Perfil Comercial</h4>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Aqui você define os <strong>padrões da empresa</strong> por função (ex: <em>Consultor Padrão</em>, <em>Microfranquia 70%</em>, <em>SDR</em>, <em>Parceiro Imobiliário</em>).
                </p>
              </div>

              <div className="rounded-xl border border-blue-200/60 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-xs">PASSO 2</span>
                <h4 className="mt-1 font-bold text-xs text-slate-900 dark:text-white">Configurar a Regra (Aba 1)</h4>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Na aba <strong>"Regras dos Perfis"</strong>, cadastre quanto o perfil ganha (ex: <em>25% da Comissão Líquida da Franqueadora</em>), o cronograma e a curva de estorno.
                </p>
              </div>

              <div className="rounded-xl border border-blue-200/60 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-xs">PASSO 3</span>
                <h4 className="mt-1 font-bold text-xs text-slate-900 dark:text-white">Vincular a Equipe (Aba 3)</h4>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Na aba <strong>"Participantes & Perfis"</strong>, associe cada vendedor/consultor ao seu perfil. Automaticamente, todas as novas vendas calcularão os repasses dele!
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-blue-100/60 px-4 py-2.5 text-[11px] font-medium text-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
              <span>⚡</span>
              <span><strong>Dica:</strong> Perfis que estão com <em>0 regra(s)</em> precisam de ao menos 1 regra cadastrada na aba <strong>"Regras dos Perfis"</strong> para poderem gerar comissões automáticas nas vendas.</span>
            </div>
          </div>
        </section>
      )}

      {/* ABA 3: PARTICIPANTES & PERFIS */}
      {activeTab === "participantes" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Vínculos de Participantes e Perfis</h2>
              <p className="text-xs text-slate-500">
                Associação de cada pessoa à sua função na venda e perfil de comissão, com suporte a overrides individuais.
              </p>
            </div>
            {canWrite && (
              <button
                onClick={() => {
                  setEditingVinculo(null);
                  setVinculoModalOpen(true);
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                + Vincular Perfil ao Participante
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="p-3.5">Participante Comercial</th>
                    <th className="p-3.5">Função na Venda</th>
                    <th className="p-3.5">Perfil Atribuído</th>
                    <th className="p-3.5">Override Individual</th>
                    <th className="p-3.5">Vigência</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {vinculos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-500">
                        <p className="font-semibold">Nenhum participante vinculado a perfis ainda.</p>
                      </td>
                    </tr>
                  ) : (
                    vinculos.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {v.participante_nome}
                        </td>
                        <td className="p-3.5">
                          <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            {v.papel_tipo}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">
                          {v.perfil_nome}
                        </td>
                        <td className="p-3.5">
                          {v.override_percentual != null ? (
                            <span className="rounded bg-amber-50 px-2 py-0.5 font-mono font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              Override: {v.override_percentual}%
                            </span>
                          ) : (
                            <span className="text-slate-400">Padrão do Perfil</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-slate-500 text-[11px]">
                          {v.vigencia_inicio} → {v.vigencia_fim || "aberta"}
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              v.ativo
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {v.ativo ? "ATIVO" : "INATIVO"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canWrite && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingVinculo(v);
                                    setVinculoModalOpen(true);
                                  }}
                                  className="rounded-lg border px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                                >
                                  Editar
                                </button>
                                <form action={unlinkParticipantePerfilAction}>
                                  <input type="hidden" name="empresa_id" value={empresaId} />
                                  <input type="hidden" name="id" value={v.id} />
                                  <button
                                    onClick={(e) => {
                                      if (!confirm("Remover este vínculo de perfil?")) e.preventDefault();
                                    }}
                                    className="rounded-lg border border-rose-200 p-1 text-rose-600 hover:bg-rose-50"
                                  >
                                    🗑️
                                  </button>
                                </form>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ABA 4: CURVAS DE ESTORNO */}
      {activeTab === "curvas" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Curvas de Estorno / Cancelamento</h2>
              <p className="text-xs text-slate-500">
                Configure múltiplas curvas de estorno com percentuais regressivos e habilite por perfil conforme a política comercial.
              </p>
            </div>

            {canWrite && (
              <button
                onClick={handleOpenNewCurva}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                + Nova Curva de Estorno
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {curvasEstorno.map((curva) => {
              const regrasUsando = regrasPerfis.filter(
                (r) => r.aplicar_curva_estorno && r.curva_estorno_id === curva.id
              ).length;

              return (
                <div
                  key={curva.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        {curva.administradora_nome || "Racon Consórcios"}
                      </span>
                      <h3 className="mt-1 font-bold text-base text-slate-900 dark:text-white">{curva.nome}</h3>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        curva.ativa
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {curva.ativa ? "ATIVA" : "INATIVA"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[32px]">
                    {curva.descricao || "Sem descrição informada."}
                  </p>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      <span>Mês Relativo</span>
                      <span>Estorno (%)</span>
                    </div>
                    <div className="divide-y divide-slate-200/50 dark:divide-slate-700/50 max-h-[140px] overflow-y-auto">
                      {curva.faixas.map((f) => (
                        <div key={f.mes_relativo} className="flex items-center justify-between py-1 text-[11px]">
                          <span className="text-slate-700 dark:text-slate-300">Até o mês {f.mes_relativo}</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            {f.percentual_estorno}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3 text-[11px] text-slate-500 dark:border-slate-800">
                    <span>
                      {curva.encerra_na_contemplacao ? "✅ Encerra na contemplação" : "Não encerra na contemplação"}
                    </span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{regrasUsando} regra(s) ativa(s)</span>
                  </div>

                  {canWrite && (
                    <div className="flex items-center justify-end gap-2 border-t pt-3 dark:border-slate-800">
                      <button
                        onClick={() => handleOpenEditCurva(curva)}
                        className="rounded-lg border px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        Editar
                      </button>
                      <form action={toggleCurvaEstornoAction}>
                        <input type="hidden" name="empresa_id" value={empresaId} />
                        <input type="hidden" name="curva_id" value={curva.id} />
                        <input type="hidden" name="ativo" value={curva.ativa ? "false" : "true"} />
                        <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400">
                          {curva.ativa ? "Inativar" : "Ativar"}
                        </button>
                      </form>
                      <form action={deleteCurvaEstornoAction}>
                        <input type="hidden" name="empresa_id" value={empresaId} />
                        <input type="hidden" name="curva_id" value={curva.id} />
                        <button
                          onClick={(e) => {
                            if (!confirm("Excluir permanentemente esta curva de estorno?")) e.preventDefault();
                          }}
                          className="rounded-lg border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 dark:border-rose-900"
                        >
                          🗑️
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ABA 5: COMISSÃO DA FRANQUEADORA */}
      {activeTab === "franquia" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Contratos Oficiais da Franqueadora</h2>
              <p className="text-xs text-slate-500">
                Comissões oficiais acordadas com as Administradoras (Racon Consórcios).
              </p>
            </div>

            {canWrite && (
              <div className="flex items-center gap-2">
                {regrasFranquia.length > 1 && (
                  <form action={cleanupDuplicateFranchiseRulesAction}>
                    <input type="hidden" name="empresa_id" value={empresaId} />
                    <button
                      onClick={(e) => {
                        if (!confirm("Deseja remover regras duplicadas mantendo apenas uma regra única para cada Tipo/Modalidade?")) {
                          e.preventDefault();
                        }
                      }}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 shadow-sm hover:bg-amber-100 transition dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    >
                      🧹 Limpar Duplicadas
                    </button>
                  </form>
                )}

                <button
                  onClick={() => {
                    setEditingFranchiseRule(null);
                    setFranchiseModalOpen(true);
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  + Nova Regra da Franqueadora
                </button>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="p-3.5">Administradora</th>
                    <th className="p-3.5">Tipo / Modalidade</th>
                    <th className="p-3.5 font-mono">Comissão da Franquia</th>
                    <th className="p-3.5">Cronograma / Etapas</th>
                    <th className="p-3.5">Vigência</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {regrasFranquia.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-500">
                        Nenhuma regra oficial da franqueadora carregada.
                      </td>
                    </tr>
                  ) : (
                    regrasFranquia.map((rf) => (
                      <tr key={rf.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {rf.administradora_nome || "Racon Consórcios"}
                        </td>
                        <td className="p-3.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {rf.tipo_nome || "Todos os Tipos"}
                          </span>
                          <span className="text-slate-400"> · </span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {rf.modalidade_nome || "Todas as Modalidades"}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                          {rf.percentual_total_comissao ? `${rf.percentual_total_comissao}%` : money.format(rf.valor_fixo_total || 0)}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400">
                          {rf.etapas_cronograma?.length || 1} etapa(s) de recebimento
                        </td>
                        <td className="p-3.5 font-mono text-slate-500 text-[11px]">
                          {rf.vigencia_inicio} → {rf.vigencia_fim || "aberta"}
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                              rf.ativa
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {rf.ativa ? "HOMOLOGADA" : "INATIVA"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canWrite && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingFranchiseRule(rf);
                                    setFranchiseModalOpen(true);
                                  }}
                                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                                >
                                  Editar
                                </button>
                                <form action={deleteFranchiseRuleAction}>
                                  <input type="hidden" name="empresa_id" value={empresaId} />
                                  <input type="hidden" name="regra_id" value={rf.id} />
                                  <button
                                    onClick={(e) => {
                                      if (!confirm("Deseja excluir esta regra de comissão da Franqueadora?")) e.preventDefault();
                                    }}
                                    title="Excluir regra"
                                    className="rounded-lg border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 dark:border-rose-900"
                                  >
                                    🗑️
                                  </button>
                                </form>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ABA 6: FISCAL & IMPOSTOS */}
      {activeTab === "fiscal" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configurações Fiscais e Tributárias</h2>
              <p className="text-xs text-slate-500">
                Alíquotas vigentes para dedução de impostos antes da apuração da comissão líquida dos participantes.
              </p>
            </div>
            {canWrite && (
              <button
                onClick={() => setFiscalModalOpen(true)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                + Nova Vigência Fiscal
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="p-3.5">Alíquota de Imposto</th>
                    <th className="p-3.5">Exibir Detalhes aos Consultores</th>
                    <th className="p-3.5">Vigência</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {fiscais.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-500">
                        Nenhuma configuração fiscal cadastrada.
                      </td>
                    </tr>
                  ) : (
                    fiscais.map((f: any) => (
                      <tr key={f.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">
                          {f.percentual_imposto}%
                        </td>
                        <td className="p-3.5">
                          {f.participante_exibe_detalhes_fiscais ? "Sim (Transparente)" : "Não (Apenas valor líquido)"}
                        </td>
                        <td className="p-3.5 font-mono text-slate-500 text-[11px]">
                          {f.vigencia_inicio} → {f.vigencia_fim || "aberta"}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                            {f.ativo ? "VIGENTE" : "ENCERRADA"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 4. MODAIS DE CRIAÇÃO E EDIÇÃO */}

      {/* MODAL: CURVA DE ESTORNO */}
      {curvaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingCurva ? "Editar Curva de Estorno" : "+ Nova Curva de Estorno"}
              </h2>
              <button onClick={() => setCurvaModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            {curvaError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
                {curvaError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingCurva(true);
                setCurvaError(null);
                try {
                  const fd = new FormData(e.currentTarget);
                  fd.set("empresa_id", empresaId);
                  fd.set("faixas_json", JSON.stringify(curvaFaixas));
                  if (editingCurva) fd.set("id", editingCurva.id);
                  const res = await saveCurvaEstornoAction({ ok: false, message: "" }, fd);
                  if (!res.ok) throw new Error(res.message);
                  setCurvaModalOpen(false);
                  router.refresh();
                } catch (err) {
                  setCurvaError(err instanceof Error ? err.message : "Erro ao salvar curva");
                } finally {
                  setIsSavingCurva(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nome da Curva *</label>
                  <input
                    name="nome"
                    required
                    defaultValue={editingCurva?.nome || ""}
                    placeholder="Ex: Curva Padrão Racon, Curva Consultor..."
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Administradora *</label>
                  <select
                    name="administradora_id"
                    required
                    defaultValue={editingCurva?.administradora_id || administradoras[0]?.id || ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {administradoras.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Descrição</label>
                <textarea
                  name="descricao"
                  rows={2}
                  defaultValue={editingCurva?.descricao || ""}
                  placeholder="Critérios de estorno e cancelamento..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="encerra_contemp"
                  name="encerra_na_contemplacao"
                  value="true"
                  defaultChecked={editingCurva ? editingCurva.encerra_na_contemplacao : true}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="encerra_contemp" className="font-semibold text-slate-700 dark:text-slate-300">
                  Encerrar obrigação de estorno imediatamente na contemplação da cota
                </label>
              </div>

              {/* Tabela de Faixas Mês a Mês */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Faixas Regressivas de Estorno</span>
                  <button
                    type="button"
                    onClick={handleAddFaixa}
                    className="rounded-lg bg-white border border-slate-300 px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400"
                  >
                    + Adicionar Mês
                  </button>
                </div>

                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {curvaFaixas.map((faixa, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px] w-20">Até Mês:</span>
                      <input
                        type="number"
                        min="1"
                        max="240"
                        value={faixa.mes}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCurvaFaixas(curvaFaixas.map((f, i) => (i === idx ? { ...f, mes: val } : f)));
                        }}
                        className="w-20 rounded-lg border border-slate-300 bg-white p-1 text-center font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <span className="text-slate-500 text-[11px] ml-2">Estorno:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={faixa.percentual}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCurvaFaixas(curvaFaixas.map((f, i) => (i === idx ? { ...f, percentual: val } : f)));
                        }}
                        className="w-20 rounded-lg border border-slate-300 bg-white p-1 text-center font-mono text-xs text-rose-600 font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400"
                      />
                      <span className="text-slate-400 text-xs">%</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFaixa(idx)}
                        className="ml-auto text-slate-400 hover:text-rose-600 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurvaModalOpen(false)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCurva}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSavingCurva ? "Salvando..." : "Salvar Curva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR / NOVA REGRA DA FRANQUEADORA */}
      {franchiseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingFranchiseRule ? "Editar Regra da Franqueadora" : "+ Nova Regra da Franqueadora"}
              </h2>
              <button onClick={() => setFranchiseModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            {franchiseError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
                {franchiseError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingFranchiseRule(true);
                setFranchiseError(null);
                try {
                  const fd = new FormData(e.currentTarget);
                  fd.set("empresa_id", empresaId);
                  if (editingFranchiseRule) {
                    fd.set("id", editingFranchiseRule.id);
                    const res = await updateFranchiseRuleAction({ ok: false, message: "" }, fd);
                    if (!res.ok) throw new Error(res.message);
                  } else {
                    const res = await createFranchiseRuleAction({ ok: false, message: "" }, fd);
                    if (!res.ok) throw new Error(res.message);
                  }
                  setFranchiseModalOpen(false);
                  router.refresh();
                } catch (err) {
                  setFranchiseError(err instanceof Error ? err.message : "Erro ao salvar regra da franqueadora");
                } finally {
                  setIsSavingFranchiseRule(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              {!editingFranchiseRule && (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Programa da Franqueadora *</label>
                  <select
                    name="programa_id"
                    required
                    defaultValue={programas[0]?.id || ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {programas.map((prog) => (
                      <option key={prog.id} value={prog.id}>
                        {prog.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tipo de Bem</label>
                  <select
                    name="tipo_administradora_id"
                    defaultValue={editingFranchiseRule?.tipo_administradora_id || ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Todos os Tipos</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Modalidade de Comissão</label>
                  <select
                    name="modalidade_comissao_id"
                    defaultValue={editingFranchiseRule?.modalidade_comissao_id || ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Todas as Modalidades</option>
                    {modalidades.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Percentual da Franquia (%) *</label>
                <input
                  name="percentual_total_comissao"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={editingFranchiseRule?.percentual_total_comissao ?? 4.0}
                  placeholder="4.00"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Início da Vigência *</label>
                  <input
                    name="vigencia_inicio"
                    type="date"
                    required
                    defaultValue={editingFranchiseRule?.vigencia_inicio || "2020-01-01"}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Fim da Vigência</label>
                  <input
                    name="vigencia_fim"
                    type="date"
                    defaultValue={editingFranchiseRule?.vigencia_fim || ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFranchiseModalOpen(false)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingFranchiseRule}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSavingFranchiseRule ? "Salvando..." : "Salvar Regra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PERFIL DE COMISSÃO */}
      {perfilModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingPerfil ? "Editar Perfil de Comissão" : "+ Novo Perfil de Comissão"}
              </h2>
              <button onClick={() => setPerfilModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            {perfilError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
                {perfilError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingPerfil(true);
                setPerfilError(null);
                try {
                  const fd = new FormData(e.currentTarget);
                  fd.set("empresa_id", empresaId);
                  if (editingPerfil) {
                    fd.set("id", editingPerfil.id);
                    const res = await updateCommissionProfileAction({ ok: false, message: "" }, fd);
                    if (!res.ok) throw new Error(res.message);
                  } else {
                    const res = await createCommissionProfileAction({ ok: false, message: "" }, fd);
                    if (!res.ok) throw new Error(res.message);
                  }
                  setPerfilModalOpen(false);
                  router.refresh();
                } catch (err) {
                  setPerfilError(err instanceof Error ? err.message : "Erro ao salvar perfil");
                } finally {
                  setIsSavingPerfil(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nome do Perfil *</label>
                <input
                  name="nome"
                  required
                  defaultValue={editingPerfil?.nome || ""}
                  placeholder="Ex: Microfranquia Premium, Consultor Trainee..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Papel / Função Base *</label>
                <select
                  name="papel_base"
                  defaultValue={editingPerfil?.papel_base || "CONSULTOR"}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="MICROFRANQUIA">Microfranquia</option>
                  <option value="CONSULTOR">Consultor</option>
                  <option value="SDR">SDR / Pré-vendedor</option>
                  <option value="INDICADOR">Indicador</option>
                  <option value="PARCEIRO">Parceiro Imobiliário</option>
                  <option value="VENDEDOR">Vendedor</option>
                  <option value="GESTOR">Gestor / Sócio</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Descrição</label>
                <textarea
                  name="descricao"
                  rows={2}
                  defaultValue={editingPerfil?.descricao || ""}
                  placeholder="Finalidade e critérios deste perfil..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPerfilModalOpen(false)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPerfil}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSavingPerfil ? "Salvando..." : "Salvar Perfil"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGRA DO PERFIL */}
      {regraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingRegra ? "Editar Regra de Perfil (Rascunho)" : "+ Nova Regra para Perfil"}
              </h2>
              <button onClick={() => setRegraModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            {regraError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
                {regraError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingRegra(true);
                setRegraError(null);
                try {
                  const fd = new FormData(e.currentTarget);
                  fd.set("empresa_id", empresaId);
                  if (editingRegra) fd.set("id", editingRegra.id);
                  const res = await saveParticipantProfileRuleAction({ ok: false, message: "" }, fd);
                  if (!res.ok) throw new Error(res.message);
                  setRegraModalOpen(false);
                  router.refresh();
                } catch (err) {
                  setRegraError(err instanceof Error ? err.message : "Erro ao salvar regra");
                } finally {
                  setIsSavingRegra(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Perfil Comercial *</label>
                  <select
                    name="perfil_id"
                    required
                    defaultValue={editingRegra?.perfil_id || perfis[0]?.id || ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {perfis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.papel_base})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Administradora *</label>
                  <select
                    name="administradora_id"
                    required
                    defaultValue={
                      editingRegra?.administradora_id ||
                      administradoras[0]?.id ||
                      ""
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {administradoras.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tipo de Bem</label>
                  <select
                    name="tipo_administradora_id"
                    defaultValue={editingRegra?.tipo_administradora_id || ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Todos os Tipos</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Modalidade de Comissão</label>
                  <select
                    name="modalidade_comissao_id"
                    defaultValue={editingRegra?.modalidade_comissao_id || ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Todas as Modalidades</option>
                    {modalidades.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Base de Cálculo *</label>
                  <select
                    name="base_v2"
                    defaultValue={editingRegra?.base_v2 || "COMISSAO_FRANQUEADORA_LIQUIDA"}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="COMISSAO_FRANQUEADORA_LIQUIDA">% da Comissão Líquida da Franquia</option>
                    <option value="VALOR_VENDIDO">% do Valor do Crédito Vendido</option>
                    <option value="VALOR_FIXO">Valor Fixo em R$</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Percentual de Repasse (%) *</label>
                  <input
                    name="percentual_comissao"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={editingRegra?.percentual_comissao ?? 50.0}
                    placeholder="Ex: 50.00"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="seguir_cronograma"
                    name="seguir_cronograma_franquia"
                    value="true"
                    defaultChecked={editingRegra ? editingRegra.seguir_cronograma_franquia : true}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="seguir_cronograma" className="font-semibold text-slate-700 dark:text-slate-300">
                    Seguir cronograma da Franqueadora
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="aplicar_curva"
                    name="aplicar_curva_estorno"
                    value="true"
                    defaultChecked={editingRegra ? editingRegra.aplicar_curva_estorno : false}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="aplicar_curva" className="font-semibold text-slate-700 dark:text-slate-300">
                    Aplicar curva de estorno
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Selecionar Curva de Estorno</label>
                <select
                  name="curva_estorno_id"
                  defaultValue={editingRegra?.curva_estorno_id || curvasEstorno[0]?.id || ""}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Selecione uma Curva de Estorno...</option>
                  {curvasEstorno.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.administradora_nome || "Racon"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Vigência Início *</label>
                  <input
                    name="vigencia_inicio"
                    type="date"
                    required
                    defaultValue={editingRegra?.vigencia_inicio || new Date().toISOString().slice(0, 10)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Vigência Fim</label>
                  <input
                    name="vigencia_fim"
                    type="date"
                    defaultValue={editingRegra?.vigencia_fim || ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRegraModalOpen(false)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingRegra}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSavingRegra ? "Salvando..." : "Salvar Regra (Rascunho)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR PARTICIPANTE AO PERFIL */}
      {vinculoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingVinculo ? "Editar Vínculo de Perfil" : "+ Vincular Perfil ao Participante"}
              </h2>
              <button onClick={() => setVinculoModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            {vinculoError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
                {vinculoError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingVinculo(true);
                setVinculoError(null);
                try {
                  const fd = new FormData(e.currentTarget);
                  fd.set("empresa_id", empresaId);
                  if (editingVinculo) fd.set("id", editingVinculo.id);
                  const res = await linkParticipantePerfilAction({ ok: false, message: "" }, fd);
                  if (!res.ok) throw new Error(res.message);
                  setVinculoModalOpen(false);
                  router.refresh();
                } catch (err) {
                  setVinculoError(err instanceof Error ? err.message : "Erro ao salvar vínculo");
                } finally {
                  setIsSavingVinculo(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Participante Comercial *</label>
                <select
                  name="participante_id"
                  required
                  defaultValue={editingVinculo?.participante_id || participantes[0]?.id || ""}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {participantes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.tipos.join(", ") || "Sem tipo"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Função Comercial nesta Regra *</label>
                <select
                  name="papel_tipo"
                  required
                  defaultValue={editingVinculo?.papel_tipo || "CONSULTOR"}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="GESTOR">Gestor / Sócio</option>
                  <option value="CONSULTOR">Consultor</option>
                  <option value="SDR">SDR / Pré-vendedor</option>
                  <option value="MICROFRANQUIA">Microfranquia</option>
                  <option value="INDICADOR">Indicador</option>
                  <option value="PARCEIRO">Parceiro</option>
                  <option value="VENDEDOR">Vendedor</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Perfil de Comissão Atribuído *</label>
                <select
                  name="perfil_id"
                  required
                  defaultValue={editingVinculo?.perfil_id || perfis[0]?.id || ""}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {perfis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.papel_base})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Override Individual (%) (Opcional)</label>
                <input
                  name="override_percentual"
                  type="number"
                  step="0.01"
                  defaultValue={editingVinculo?.override_percentual ?? ""}
                  placeholder="Deixe em branco para usar o percentual do Perfil"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Vigência Início</label>
                  <input
                    name="vigencia_inicio"
                    type="date"
                    defaultValue={editingVinculo?.vigencia_inicio || new Date().toISOString().slice(0, 10)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Vigência Fim</label>
                  <input
                    name="vigencia_fim"
                    type="date"
                    defaultValue={editingVinculo?.vigencia_fim || ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setVinculoModalOpen(false)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingVinculo}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSavingVinculo ? "Salvando..." : "Salvar Vínculo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ALÍQUOTA FISCAL */}
      {fiscalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">+ Nova Vigência Fiscal</h2>
              <button onClick={() => setFiscalModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            {fiscalError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
                {fiscalError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingFiscal(true);
                setFiscalError(null);
                try {
                  const fd = new FormData(e.currentTarget);
                  fd.set("empresa_id", empresaId);
                  const res = await saveFiscalConfigAction({ ok: false, message: "" }, fd);
                  if (!res.ok) throw new Error(res.message);
                  setFiscalModalOpen(false);
                  router.refresh();
                } catch (err) {
                  setFiscalError(err instanceof Error ? err.message : "Erro ao salvar configuração fiscal");
                } finally {
                  setIsSavingFiscal(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Alíquota de Imposto Total (%) *</label>
                <input
                  name="percentual_imposto"
                  type="number"
                  step="0.0001"
                  required
                  defaultValue={17.33}
                  placeholder="17.33"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono text-sm"
                />
                <p className="mt-1 text-[11px] text-slate-400">PIS, COFINS, ISS e tributos incidentes na nota da Franqueadora.</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Início da Vigência *</label>
                <input
                  name="vigencia_inicio"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="exibe_fiscais"
                  name="participante_exibe_detalhes_fiscais"
                  value="true"
                  defaultChecked={true}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="exibe_fiscais" className="font-semibold text-slate-700 dark:text-slate-300">
                  Exibir dedução fiscal nos extratos dos consultores
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFiscalModalOpen(false)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingFiscal}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSavingFiscal ? "Salvando..." : "Salvar Configuração Fiscal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
