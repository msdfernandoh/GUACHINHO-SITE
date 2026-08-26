"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LeadListRow, LeadFilters } from "@/lib/crm/types";
import type { ConsultorOption } from "@/lib/admin/consultores";
import {
  updateLeadAction,
  deleteLeadAction,
  bulkDeleteLeadsAction,
  fecharLeadAction,
  createLeadManualAction,
} from "@/app/admin/leads/actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatSimpleDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const ORIGENS_MAP: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  meta: { label: "Facebook / Meta", icon: "📱", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300" },
  facebook: { label: "Facebook", icon: "📱", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300" },
  instagram: { label: "Instagram", icon: "📷", bg: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-300" },
  site: { label: "Site Oficial", icon: "🌐", bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300" },
  simulador_consorcio: { label: "Simulador Consórcio", icon: "🎯", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300" },
  simulador_financiamento: { label: "Simulador Financiamento", icon: "📊", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300" },
  grupos: { label: "Catálogo Grupos", icon: "📑", bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300" },
  contratacao_online: { label: "Contratação Online", icon: "✍️", bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300" },
  contratacao_assinada: { label: "Contrato Assinado", icon: "✅", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300" },
  indicacao: { label: "Indicação", icon: "👥", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300" },
  evento: { label: "Evento / Sorteio", icon: "🎟️", bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300" },
  evento_sorteio: { label: "Evento / Sorteio", icon: "🎟️", bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300" },
  whatsapp: { label: "WhatsApp Direto", icon: "💬", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300" },
  manual: { label: "Cadastro Manual", icon: "📝", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  manual_admin: { label: "Manual ERP", icon: "📝", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
};

function getOrigemBadge(origemRaw: string | null | undefined) {
  if (!origemRaw) return { label: "Site", icon: "🌐", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" };
  const key = origemRaw.toLowerCase().trim();
  if (ORIGENS_MAP[key]) return ORIGENS_MAP[key];
  for (const k of Object.keys(ORIGENS_MAP)) {
    if (key.includes(k)) return ORIGENS_MAP[k];
  }
  return {
    label: origemRaw.length > 20 ? origemRaw.slice(0, 18) + "..." : origemRaw,
    icon: "📌",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  };
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Novo: { label: "NOVO", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  "Em atendimento": { label: "EM ATENDIMENTO", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  "Tentativa de contato": { label: "TENTATIVA CONTATO", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  Qualificado: { label: "QUALIFICADO", bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  "Simulação enviada": { label: "SIMULAÇÃO", bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
  "Proposta enviada": { label: "PROPOSTA", bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  Negociação: { label: "NEGOCIAÇÃO", bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  Fechado: { label: "FECHADO", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  Perdido: { label: "PERDIDO", bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
  "Sem resposta": { label: "SEM RESPOSTA", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", border: "border-slate-200 dark:border-slate-700" },
  Arquivado: { label: "ARQUIVADO", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-500 dark:text-slate-400", border: "border-slate-200 dark:border-slate-700" },
};

function getStatusBadge(statusRaw: string | null | undefined) {
  if (!statusRaw) return STATUS_CONFIG.Novo;
  return STATUS_CONFIG[statusRaw] || {
    label: statusRaw.toUpperCase(),
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
  };
}

export function ErpLeadsView({
  initialLeads,
  consultores,
  eventos,
  currentFilters,
  canDelete,
}: {
  initialLeads: LeadListRow[];
  consultores: ConsultorOption[];
  eventos: { id: string; nome: string }[];
  currentFilters: LeadFilters;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Mode: List vs Kanban (persisted in localStorage)
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  useEffect(() => {
    const saved = localStorage.getItem("gauchinho_erp_leads_view_mode");
    if (saved === "list" || saved === "kanban") setViewMode(saved);
  }, []);

  const handleSetViewMode = (mode: "list" | "kanban") => {
    setViewMode(mode);
    localStorage.setItem("gauchinho_erp_leads_view_mode", mode);
  };

  // Selected leads for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkResponsavelId, setBulkResponsavelId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  // Drawer / Modal for Lead Details
  const [activeLead, setActiveLead] = useState<LeadListRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Quick New Lead Modal
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false);
  const [newLeadError, setNewLeadError] = useState<string | null>(null);
  const [isSavingNew, setIsSavingNew] = useState(false);

  // Quick Interaction Note Form in Drawer
  const [interactionNote, setInteractionNote] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [nextActionText, setNextActionText] = useState("");
  const [isSavingInteraction, setIsSavingInteraction] = useState(false);

  // Filter Bar state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(currentFilters.q || "");
  const [statusFilter, setStatusFilter] = useState(currentFilters.status || "");
  const [origemFilter, setOrigemFilter] = useState(currentFilters.origem || "");
  const [srdFilter, setSrdFilter] = useState(currentFilters.srd || "");
  const [periodoFilter, setPeriodoFilter] = useState(currentFilters.periodo || "");
  const [somenteNovos, setSomenteNovos] = useState(currentFilters.somente_novos === "1");
  const [semResponsavel, setSemResponsavel] = useState(currentFilters.sem_responsavel === "1");
  const [acaoVencida, setAcaoVencida] = useState(currentFilters.acao_vencida === "1");

  // Local Filtered Leads
  const leads = useMemo(() => {
    return initialLeads.filter((lead) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (lead.nome || "").toLowerCase().includes(q) ||
          (lead.whatsapp || "").includes(q) ||
          (lead.email || "").toLowerCase().includes(q) ||
          (lead.cidade || "").toLowerCase().includes(q) ||
          (lead.produto_interesse || "").toLowerCase().includes(q) ||
          (lead.origem || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (statusFilter && lead.status !== statusFilter) return false;
      if (origemFilter && lead.origem !== origemFilter) return false;
      if (srdFilter && lead.srd_responsavel_id !== srdFilter) return false;
      if (somenteNovos && lead.status !== "Novo") return false;
      if (semResponsavel && lead.srd_responsavel_id) return false;
      if (acaoVencida) {
        const nowIso = new Date().toISOString().slice(0, 10);
        const actionDate = lead.data_proxima_acao || lead.proximo_retorno_data;
        if (!actionDate || actionDate >= nowIso) return false;
      }
      return true;
    });
  }, [
    initialLeads,
    searchQuery,
    statusFilter,
    origemFilter,
    srdFilter,
    somenteNovos,
    semResponsavel,
    acaoVencida,
  ]);

  // Real KPI Metrics
  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ativos = initialLeads.filter((l) => !["Fechado", "Perdido", "Arquivado"].includes(l.status)).length;
    const novos = initialLeads.filter((l) => l.status === "Novo").length;
    const emAtendimento = initialLeads.filter((l) =>
      ["Em atendimento", "Tentativa de contato", "Qualificado", "Simulação enviada", "Proposta enviada", "Negociação"].includes(l.status)
    ).length;
    // Sem contato canônico: status Novo e nunca interagiu
    const semContato = initialLeads.filter(
      (l) => l.status === "Novo" && !l.ultima_interacao_at
    ).length;
    const vencidas = initialLeads.filter((l) => {
      const act = l.data_proxima_acao || l.proximo_retorno_data;
      return act && act < today && !["Fechado", "Perdido", "Arquivado"].includes(l.status);
    }).length;
    const convertidos = initialLeads.filter((l) => l.fechado || l.status === "Fechado").length;

    return { ativos, novos, emAtendimento, semContato, vencidas, convertidos };
  }, [initialLeads]);

  // Select all / toggle
  const isAllSelected = leads.length > 0 && selectedIds.length === leads.length;
  const handleToggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(leads.map((l) => l.id));
  };
  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      "ID",
      "Nome",
      "Telefone/WhatsApp",
      "E-mail",
      "Cidade",
      "Origem",
      "Produto/Interesse",
      "Valor Estimado",
      "Status",
      "Responsável",
      "Último Contato",
      "Próxima Ação",
      "Data Cadastro",
    ];
    const rows = leads.map((l) => [
      l.id,
      `"${(l.nome || "").replace(/"/g, '""')}"`,
      `"${l.whatsapp || ""}"`,
      `"${l.email || ""}"`,
      `"${l.cidade || ""}"`,
      `"${l.origem || ""}"`,
      `"${l.produto_interesse || l.tipo_interesse || ""}"`,
      l.valor_estimado || l.valor_simulado || 0,
      `"${l.status || ""}"`,
      `"${l.srd_responsavel_nome || ""}"`,
      l.ultima_interacao_at || "",
      l.data_proxima_acao || l.proximo_retorno_data || "",
      l.created_at || "",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_gauchinho_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Apply Responsável
  const handleApplyBulkResponsavel = async () => {
    if (!bulkResponsavelId || selectedIds.length === 0) return;
    setBulkMessage("Atualizando responsáveis...");
    try {
      const selectedSrd = consultores.find((c) => c.id === bulkResponsavelId);
      for (const leadId of selectedIds) {
        const fd = new FormData();
        fd.set("srd_responsavel_id", bulkResponsavelId);
        fd.set("srd_responsavel_nome", selectedSrd?.nome || "");
        await updateLeadAction(leadId, fd);
      }
      setBulkMessage("Responsável atualizado com sucesso!");
      setTimeout(() => {
        setSelectedIds([]);
        setBulkActionOpen(false);
        setBulkMessage(null);
        router.refresh();
      }, 800);
    } catch (err) {
      setBulkMessage(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  };

  // Bulk Apply Status
  const handleApplyBulkStatus = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;
    setBulkMessage("Atualizando status...");
    try {
      for (const leadId of selectedIds) {
        const fd = new FormData();
        fd.set("status", bulkStatus);
        await updateLeadAction(leadId, fd);
      }
      setBulkMessage("Status atualizado com sucesso!");
      setTimeout(() => {
        setSelectedIds([]);
        setBulkActionOpen(false);
        setBulkMessage(null);
        router.refresh();
      }, 800);
    } catch (err) {
      setBulkMessage(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!canDelete || selectedIds.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir permanentemente ${selectedIds.length} lead(s)?`)) return;
    try {
      await bulkDeleteLeadsAction(selectedIds, "EXCLUIR");
      setSelectedIds([]);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir leads");
    }
  };

  // Open Drawer Details
  const handleOpenLead = (lead: LeadListRow) => {
    setActiveLead(lead);
    setDrawerOpen(true);
    setInteractionNote("");
    setNextActionDate(lead.data_proxima_acao || lead.proximo_retorno_data || "");
    setNextActionText(lead.proxima_acao || "");
  };

  // Save Interaction / Follow-up from Drawer
  const handleSaveInteraction = async () => {
    if (!activeLead) return;
    setIsSavingInteraction(true);
    try {
      const fd = new FormData();
      if (interactionNote.trim()) {
        fd.set("observacoes", `${activeLead.status || ""}: ${interactionNote.trim()}`);
      }
      if (nextActionDate) {
        fd.set("data_proxima_acao", nextActionDate);
      }
      if (nextActionText) {
        fd.set("proxima_acao", nextActionText);
      }
      await updateLeadAction(activeLead.id, fd);
      setDrawerOpen(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar interação");
    } finally {
      setIsSavingInteraction(false);
    }
  };

  // Move Kanban Stage
  const handleMoveKanbanStage = async (leadId: string, newStatus: string) => {
    try {
      const fd = new FormData();
      fd.set("status", newStatus);
      await updateLeadAction(leadId, fd);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar estágio");
    }
  };

  // Kanban Columns
  const kanbanColumns = [
    { id: "Novo", title: "Novos", color: "border-blue-400 bg-blue-50/40 text-blue-800 dark:text-blue-300" },
    { id: "Em atendimento", title: "Em Atendimento", color: "border-amber-400 bg-amber-50/40 text-amber-800 dark:text-amber-300" },
    { id: "Qualificado", title: "Qualificados", color: "border-purple-400 bg-purple-50/40 text-purple-800 dark:text-purple-300" },
    { id: "Proposta enviada", title: "Proposta Enviada", color: "border-indigo-400 bg-indigo-50/40 text-indigo-800 dark:text-indigo-300" },
    { id: "Negociação", title: "Negociação", color: "border-orange-400 bg-orange-50/40 text-orange-800 dark:text-orange-300" },
    { id: "Fechado", title: "Fechados / Convertidos", color: "border-emerald-400 bg-emerald-50/40 text-emerald-800 dark:text-emerald-300" },
    { id: "Perdido", title: "Perdidos", color: "border-rose-400 bg-rose-50/40 text-rose-800 dark:text-rose-300" },
  ];

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO ERP */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">CRM / Leads</h1>
            <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {leads.length} {leads.length === 1 ? "lead" : "leads"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gestão comercial de oportunidades da franquia
          </p>
        </div>

        {/* Ações Rápidas no Topo */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternador de Modo */}
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => handleSetViewMode("list")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewMode === "list"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <span>📋</span> Lista
            </button>
            <button
              onClick={() => handleSetViewMode("kanban")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewMode === "kanban"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <span>📊</span> Kanban
            </button>
          </div>

          <button
            onClick={() => setNewLeadModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <span>+</span> Novo Lead
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white transition"
          >
            <span>📥</span> Exportar CSV
          </button>

          <Link
            href="/erp/relatorios"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white transition"
          >
            <span>📈</span> Relatórios
          </Link>
        </div>
      </div>

      {/* 2. CARDS DE MÉTRICAS KPI (DADOS REAIS) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500">Leads Ativos</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{metrics.ativos}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Novos</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-900 dark:text-blue-200">{metrics.novos}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Em Atendimento</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-900 dark:text-amber-200">{metrics.emAtendimento}</p>
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4 shadow-sm dark:border-purple-900/40 dark:bg-purple-950/20">
          <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">Sem Contato</p>
          <p className="mt-1 text-2xl font-extrabold text-purple-900 dark:text-purple-200">{metrics.semContato}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/20">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Ações Vencidas</p>
          <p className="mt-1 text-2xl font-extrabold text-rose-900 dark:text-rose-200">{metrics.vencidas}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Convertidos</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-900 dark:text-emerald-200">{metrics.convertidos}</p>
        </div>
      </div>

      {/* 3. BARRA DE FILTROS ERP RECOLHÍVEL */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, telefone, e-mail, cidade ou produto..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                filtersOpen || statusFilter || origemFilter || srdFilter || somenteNovos || semResponsavel || acaoVencida
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              }`}
            >
              <span>⚙️</span> Filtros Avançados
              {(statusFilter || origemFilter || srdFilter || somenteNovos || semResponsavel || acaoVencida) && (
                <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] text-white">●</span>
              )}
            </button>

            {(searchQuery || statusFilter || origemFilter || srdFilter || somenteNovos || semResponsavel || acaoVencida) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("");
                  setOrigemFilter("");
                  setSrdFilter("");
                  setSomenteNovos(false);
                  setSemResponsavel(false);
                  setAcaoVencida(false);
                }}
                className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {filtersOpen && (
          <div className="grid gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Todos os Status</option>
                {Object.keys(STATUS_CONFIG).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Origem</label>
              <select
                value={origemFilter}
                onChange={(e) => setOrigemFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Todas as Origens</option>
                {Object.entries(ORIGENS_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Responsável / SDR</label>
              <select
                value={srdFilter}
                onChange={(e) => setSrdFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Todos os Consultores</option>
                {consultores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={semResponsavel}
                  onChange={(e) => setSemResponsavel(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Sem Responsável Atribuído
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acaoVencida}
                  onChange={(e) => setAcaoVencida(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                Ação / Retorno Vencido
              </label>
            </div>
          </div>
        )}
      </section>

      {/* 4. FLOATING BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-300 bg-blue-600 p-4 text-white shadow-xl animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold">
              {selectedIds.length} selecionado(s)
            </span>
            <p className="text-xs font-semibold">Ações em massa disponíveis:</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Atribuir SDR */}
            <div className="flex items-center gap-1.5">
              <select
                value={bulkResponsavelId}
                onChange={(e) => setBulkResponsavelId(e.target.value)}
                className="rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-xs text-white placeholder-white/60 focus:bg-white focus:text-slate-900 focus:outline-none"
              >
                <option value="" className="text-slate-900">Atribuir Consultor...</option>
                {consultores.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-900">
                    {c.nome}
                  </option>
                ))}
              </select>
              <button
                onClick={handleApplyBulkResponsavel}
                disabled={!bulkResponsavelId}
                className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-50 hover:bg-blue-50 transition"
              >
                Aplicar
              </button>
            </div>

            {/* Mudar Status */}
            <div className="flex items-center gap-1.5">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-xs text-white placeholder-white/60 focus:bg-white focus:text-slate-900 focus:outline-none"
              >
                <option value="" className="text-slate-900">Alterar Status...</option>
                {Object.keys(STATUS_CONFIG).map((st) => (
                  <option key={st} value={st} className="text-slate-900">
                    {st}
                  </option>
                ))}
              </select>
              <button
                onClick={handleApplyBulkStatus}
                disabled={!bulkStatus}
                className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-50 hover:bg-blue-50 transition"
              >
                Aplicar
              </button>
            </div>

            {canDelete && (
              <button
                onClick={handleBulkDelete}
                className="rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-600 transition"
              >
                Excluir
              </button>
            )}

            <button
              onClick={() => setSelectedIds([])}
              className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* 5. VISUALIZAÇÃO: LISTA OPERACIONAL vs KANBAN */}
      {viewMode === "list" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="p-3.5">Lead / Contato</th>
                  <th className="p-3.5">Origem</th>
                  <th className="p-3.5">Produto / Interesse</th>
                  <th className="p-3.5">Cidade</th>
                  <th className="p-3.5 font-mono">Valor Estimado</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Responsável</th>
                  <th className="p-3.5">Último Contato</th>
                  <th className="p-3.5">Próxima Ação</th>
                  <th className="p-3.5 text-center">Entrada</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-12 text-center text-slate-500 dark:text-slate-400">
                      <p className="text-sm font-semibold">Nenhum lead encontrado com os filtros aplicados.</p>
                      <p className="mt-1 text-xs text-slate-400">Tente ajustar os termos de busca ou filtros.</p>
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => {
                    const isSelected = selectedIds.includes(lead.id);
                    const origBadge = getOrigemBadge(lead.origem);
                    const statBadge = getStatusBadge(lead.status);
                    const valorEst = lead.valor_estimado || lead.valor_simulado || 0;
                    const cleanPhone = (lead.whatsapp || "").replace(/\D/g, "");
                    const isOverdue =
                      (lead.data_proxima_acao || lead.proximo_retorno_data) &&
                      (lead.data_proxima_acao || lead.proximo_retorno_data)! < new Date().toISOString().slice(0, 10);

                    return (
                      <tr
                        key={lead.id}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-blue-50/70 dark:bg-blue-950/30"
                            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(lead.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>

                        {/* Lead / Nome + WhatsApp */}
                        <td className="p-3.5">
                          <button
                            onClick={() => handleOpenLead(lead)}
                            className="text-left font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 transition"
                          >
                            {lead.nome || "Lead sem nome"}
                          </button>
                          <div className="mt-0.5 flex items-center gap-2">
                            {lead.whatsapp && (
                              <a
                                href={`https://wa.me/55${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                              >
                                <span>💬</span> {formatPhone(lead.whatsapp)}
                              </a>
                            )}
                            {lead.email && (
                              <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                                {lead.email}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Origem */}
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${origBadge.bg} ${origBadge.text}`}
                          >
                            <span>{origBadge.icon}</span> {origBadge.label}
                          </span>
                        </td>

                        {/* Produto / Interesse */}
                        <td className="p-3.5 text-slate-700 dark:text-slate-300">
                          {lead.produto_interesse || lead.tipo_interesse || lead.tipo_sonho || "Consórcio"}
                        </td>

                        {/* Cidade */}
                        <td className="p-3.5 text-slate-600 dark:text-slate-400">
                          {lead.cidade || "—"}
                        </td>

                        {/* Valor Estimado */}
                        <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          {valorEst > 0 ? money.format(valorEst) : "—"}
                        </td>

                        {/* Status */}
                        <td className="p-3.5 text-center">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${statBadge.bg} ${statBadge.text} ${statBadge.border}`}
                          >
                            {statBadge.label}
                          </span>
                        </td>

                        {/* Responsável */}
                        <td className="p-3.5">
                          {lead.srd_responsavel_nome ? (
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {lead.srd_responsavel_nome}
                            </span>
                          ) : (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400 dark:bg-slate-800">
                              Não atribuído
                            </span>
                          )}
                        </td>

                        {/* Último Contato */}
                        <td className="p-3.5 text-slate-500 dark:text-slate-400">
                          {lead.ultima_interacao_at ? (
                            <span>{formatSimpleDate(lead.ultima_interacao_at)}</span>
                          ) : (
                            <span className="text-purple-600 dark:text-purple-400 font-semibold">
                              Sem contato
                            </span>
                          )}
                        </td>

                        {/* Próxima Ação */}
                        <td className="p-3.5">
                          {lead.data_proxima_acao || lead.proximo_retorno_data ? (
                            <span
                              className={`rounded px-2 py-0.5 font-semibold text-[11px] ${
                                isOverdue
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {formatSimpleDate(lead.data_proxima_acao || lead.proximo_retorno_data)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Entrada */}
                        <td className="p-3.5 text-center text-slate-500 font-mono text-[11px]">
                          {formatSimpleDate(lead.created_at)}
                        </td>

                        {/* Ações */}
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenLead(lead)}
                              title="Ver Detalhes do Lead"
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              👁️
                            </button>
                            {lead.whatsapp && (
                              <a
                                href={`https://wa.me/55${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Conversar no WhatsApp"
                                className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              >
                                💬
                              </a>
                            )}
                            <Link
                              href={`/admin/propostas/nova?leadId=${lead.id}`}
                              title="Gerar Proposta Comercial"
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              📑
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* KANBAN DO FUNIL ERP */
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7 overflow-x-auto pb-4">
          {kanbanColumns.map((col) => {
            const colLeads = leads.filter((l) => {
              if (col.id === "Novo") return l.status === "Novo";
              if (col.id === "Fechado") return l.fechado || l.status === "Fechado";
              return l.status === col.id;
            });
            const colTotal = colLeads.reduce(
              (acc, curr) => acc + (curr.valor_estimado || curr.valor_simulado || 0),
              0
            );

            return (
              <div
                key={col.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60 min-w-[260px]"
              >
                {/* Header da Coluna */}
                <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${col.color}`}>
                      {col.title}
                    </span>
                    <span className="text-xs font-bold text-slate-500">({colLeads.length})</span>
                  </div>
                </div>
                {colTotal > 0 && (
                  <p className="mt-1 text-[11px] font-mono font-semibold text-slate-400">
                    {money.format(colTotal)}
                  </p>
                )}

                {/* Cards */}
                <div className="mt-3 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-360px)]">
                  {colLeads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
                      Nenhum lead nesta etapa
                    </div>
                  ) : (
                    colLeads.map((lead) => {
                      const origBadge = getOrigemBadge(lead.origem);
                      const cleanPhone = (lead.whatsapp || "").replace(/\D/g, "");
                      const val = lead.valor_estimado || lead.valor_simulado || 0;

                      return (
                        <div
                          key={lead.id}
                          className="group rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm hover:border-blue-300 hover:shadow transition dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => handleOpenLead(lead)}
                              className="text-left font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                            >
                              {lead.nome || "Lead sem nome"}
                            </button>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${origBadge.bg} ${origBadge.text}`}
                            >
                              {origBadge.icon}
                            </span>
                          </div>

                          {lead.whatsapp && (
                            <div className="mt-1">
                              <a
                                href={`https://wa.me/55${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                              >
                                💬 {formatPhone(lead.whatsapp)}
                              </a>
                            </div>
                          )}

                          {val > 0 && (
                            <p className="mt-1.5 font-mono text-xs font-extrabold text-blue-700 dark:text-blue-400">
                              {money.format(val)}
                            </p>
                          )}

                          <div className="mt-2.5 flex items-center justify-between border-t pt-2 text-[11px] text-slate-500 dark:border-slate-800">
                            <span>{lead.srd_responsavel_nome || "Sem consultor"}</span>

                            <select
                              value={lead.status}
                              onChange={(e) => handleMoveKanbanStage(lead.id, e.target.value)}
                              className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {kanbanColumns.map((c) => (
                                <option key={c.id} value={c.id}>
                                  Mover: {c.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. DRAWER / MODAL LATERAL DE DETALHES DO LEAD */}
      {drawerOpen && activeLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl h-full bg-white p-6 shadow-2xl overflow-y-auto dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 space-y-6">
            {/* Header do Drawer */}
            <div className="flex items-start justify-between border-b pb-4 dark:border-slate-800">
              <div>
                <span
                  className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${getStatusBadge(activeLead.status).bg} ${getStatusBadge(activeLead.status).text} ${getStatusBadge(activeLead.status).border}`}
                >
                  {getStatusBadge(activeLead.status).label}
                </span>
                <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {activeLead.nome || "Lead sem nome"}
                </h2>
                <p className="text-xs text-slate-400">ID: {activeLead.id}</p>
              </div>

              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Ações Rápidas do Lead */}
            <div className="flex flex-wrap gap-2">
              {activeLead.whatsapp && (
                <a
                  href={`https://wa.me/55${(activeLead.whatsapp || "").replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                >
                  <span>💬</span> WhatsApp Direto
                </a>
              )}
              <Link
                href={`/admin/propostas/nova?leadId=${activeLead.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <span>📑</span> Criar Proposta
              </Link>
            </div>

            {/* Dados Cadastrais & Contato */}
            <div className="rounded-2xl border border-slate-200 p-4 space-y-3 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Dados de Contato & Interesse</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500">Telefone / WhatsApp:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatPhone(activeLead.whatsapp) || "Não informado"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">E-mail:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {activeLead.email || "Não informado"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Cidade / UF:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {activeLead.cidade || "Não informada"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Origem:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {getOrigemBadge(activeLead.origem).label}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Produto / Interesse:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {activeLead.produto_interesse || activeLead.tipo_interesse || "Consórcio"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Valor Estimado:</span>
                  <p className="font-mono font-bold text-blue-700 dark:text-blue-400">
                    {money.format(activeLead.valor_estimado || activeLead.valor_simulado || 0)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Consultor Responsável:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {activeLead.srd_responsavel_nome || "Não atribuído"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Data de Entrada:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatDate(activeLead.created_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* Formulário Rápido de Registrar Atendimento / Próxima Ação */}
            <div className="rounded-2xl border border-slate-200 p-4 space-y-3 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Registrar Atendimento / Próxima Ação
              </h3>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Nova Anotação ou Histórico de Contato:
                </label>
                <textarea
                  value={interactionNote}
                  onChange={(e) => setInteractionNote(e.target.value)}
                  placeholder="Ex: Cliente tem interesse em carta de 500k para imóvel em Sinop. Retornar amanhã às 14h..."
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Data da Próxima Ação:
                  </label>
                  <input
                    type="date"
                    value={nextActionDate}
                    onChange={(e) => setNextActionDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Descrição da Ação:
                  </label>
                  <input
                    type="text"
                    value={nextActionText}
                    onChange={(e) => setNextActionText(e.target.value)}
                    placeholder="Ex: Enviar proposta"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-700 dark:text-slate-300"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSaveInteraction}
                  disabled={isSavingInteraction}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSavingInteraction ? "Salvando..." : "Salvar Atendimento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE NOVO LEAD RÁPIDO */}
      {newLeadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">+ Novo Lead Manual</h2>
              <button
                onClick={() => setNewLeadModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {newLeadError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
                {newLeadError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingNew(true);
                setNewLeadError(null);
                try {
                  const fd = new FormData(e.currentTarget);
                  fd.set("origem", "manual_admin");
                  await createLeadManualAction(fd);
                  setNewLeadModalOpen(false);
                  router.refresh();
                } catch (err) {
                  setNewLeadError(err instanceof Error ? err.message : "Erro ao cadastrar lead");
                } finally {
                  setIsSavingNew(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nome Completo *</label>
                <input
                  name="nome"
                  required
                  placeholder="Nome do cliente"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">WhatsApp / Celular *</label>
                  <input
                    name="whatsapp"
                    required
                    placeholder="(00) 00000-0000"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">E-mail</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="email@cliente.com"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Cidade</label>
                  <input
                    name="cidade"
                    placeholder="Ex: Sinop"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Produto / Interesse</label>
                  <input
                    name="produto_interesse"
                    placeholder="Ex: Imóvel R$ 500k"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Valor Estimado (R$)</label>
                  <input
                    name="valor_estimado"
                    type="number"
                    step="0.01"
                    placeholder="500000"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Consultor Responsável</label>
                  <select
                    name="srd_responsavel_id"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Selecione um Consultor...</option>
                    {consultores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Observações Iniciais</label>
                <textarea
                  name="observacoes"
                  rows={2}
                  placeholder="Detalhes ou preferência do cliente..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewLeadModalOpen(false)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNew}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSavingNew ? "Cadastrando..." : "Cadastrar Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
