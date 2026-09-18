"use client";

import { useState, useEffect, useTransition } from "react";
import type { LeadListRow, CrmFunilEtapaRow, LeadFilters } from "@/lib/crm/types";
import { formatCurrency } from "@/lib/utils/format";
import { valorEstimadoLead } from "@/lib/crm/constants";
import { CrmLeadCard } from "./crm-lead-card";
import { CrmStageMoveModal } from "./crm-stage-move-modal";
import { updateLeadEtapaAction } from "@/app/admin/leads/actions";
import {
  Search,
  Filter,
  Kanban,
  Sparkles,
  UserCheck,
  AlertTriangle,
  Clock,
  Flame,
  UserX,
  FileQuestion,
} from "lucide-react";
import type { ConsultorOption } from "@/lib/admin/consultores";

export function CrmKanbanBoard({
  initialLeads,
  etapas,
  consultores,
  currentUserId,
  initialFilters,
}: {
  initialLeads: LeadListRow[];
  etapas: CrmFunilEtapaRow[];
  consultores: ConsultorOption[];
  currentUserId?: string;
  initialFilters?: LeadFilters;
}) {
  const [leads, setLeads] = useState<LeadListRow[]>(initialLeads);
  const [isPending, startTransition] = useTransition();

  // Drag & Drop State
  const [draggedLead, setDraggedLead] = useState<LeadListRow | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    setCurrentTime(Date.now());
  }, []);

  // Modal de Transição de Etapa
  const [pendingMove, setPendingMove] = useState<{
    lead: LeadListRow;
    targetEtapa: CrmFunilEtapaRow;
  } | null>(null);

  // Filtros locais em tempo real
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConsultor, setSelectedConsultor] = useState("");
  const [activeQuickFilter, setActiveQuickFilter] = useState<
    "todos" | "meus" | "sem_responsavel" | "sem_contato_24h" | "parados_7d" | "quentes" | "incompletos"
  >("todos");

  // Filtro em tempo real
  const now = currentTime ?? 0;
  const filteredLeads = leads.filter((lead) => {
    // 1. Busca textual
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        lead.nome.toLowerCase().includes(q) ||
        (lead.whatsapp && lead.whatsapp.includes(q)) ||
        (lead.email && lead.email.toLowerCase().includes(q)) ||
        (lead.cidade && lead.cidade.toLowerCase().includes(q)) ||
        (lead.origem && lead.origem.toLowerCase().includes(q));
      if (!match) return false;
    }

    // 2. Filtro de consultor
    if (selectedConsultor && lead.srd_responsavel_id !== selectedConsultor) {
      return false;
    }

    // 3. SDR Quick Filter Pills
    if (activeQuickFilter === "meus") {
      if (!currentUserId || lead.srd_responsavel_id !== currentUserId) return false;
    } else if (activeQuickFilter === "sem_responsavel") {
      if (lead.srd_responsavel_id) return false;
    } else if (activeQuickFilter === "sem_contato_24h") {
      const last = lead.ultima_interacao_at || lead.created_at;
      const hours = (now - new Date(last).getTime()) / (1000 * 60 * 60);
      if (hours < 24 || lead.fechado) return false;
    } else if (activeQuickFilter === "parados_7d") {
      const last = lead.ultima_interacao_at || lead.created_at;
      const hours = (now - new Date(last).getTime()) / (1000 * 60 * 60);
      if (hours < 168 || lead.fechado) return false;
    } else if (activeQuickFilter === "quentes") {
      if (
        lead.temperatura !== "Quente" &&
        lead.temperatura !== "Muito quente" &&
        lead.temperatura !== "Urgente"
      )
        return false;
    } else if (activeQuickFilter === "incompletos") {
      if (!lead.is_incompleto) return false;
    }

    return true;
  });

  // Agrupamento por etapa
  const leadsByEtapa = new Map<string, LeadListRow[]>();
  const totalValueByEtapa = new Map<string, number>();

  for (const e of etapas) {
    leadsByEtapa.set(e.id, []);
    totalValueByEtapa.set(e.id, 0);
  }

  for (const l of filteredLeads) {
    let etapaId = l.etapa_id;
    if (!etapaId || !leadsByEtapa.has(etapaId)) {
      const found = etapas.find(
        (e) => e.slug === l.status || e.nome.toLowerCase() === (l.status ?? "").toLowerCase(),
      );
      if (found) etapaId = found.id;
      else if (etapas.length > 0) etapaId = etapas[0].id;
    }

    if (etapaId && leadsByEtapa.has(etapaId)) {
      leadsByEtapa.get(etapaId)!.push(l);
      totalValueByEtapa.set(
        etapaId,
        (totalValueByEtapa.get(etapaId) ?? 0) + valorEstimadoLead(l),
      );
    }
  }

  // Drag & Drop Handlers
  function handleDragStart(e: React.DragEvent, lead: LeadListRow) {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lead.id);
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  }

  function handleDragLeave(e: React.DragEvent, stageId: string) {
    if (dragOverStageId === stageId) {
      setDragOverStageId(null);
    }
  }

  function handleDrop(e: React.DragEvent, targetEtapa: CrmFunilEtapaRow) {
    e.preventDefault();
    setDragOverStageId(null);
    if (!draggedLead) return;

    // Se já está na mesma etapa, não faz nada
    if (draggedLead.etapa_id === targetEtapa.id || draggedLead.status === targetEtapa.nome) {
      setDraggedLead(null);
      return;
    }

    // Abre o modal rápido para coletar observação/motivo/próxima ação
    setPendingMove({ lead: draggedLead, targetEtapa });
    setDraggedLead(null);
  }

  function executeMove(extra: {
    proximaAcao?: string;
    dataProximaAcao?: string;
    observacao?: string;
    motivoPerda?: string;
    temperatura?: string;
  }) {
    if (!pendingMove) return;
    const { lead, targetEtapa } = pendingMove;

    // Atualização otimista imediata na UI
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id
          ? {
              ...l,
              etapa_id: targetEtapa.id,
              status: targetEtapa.nome,
              proxima_acao: extra.proximaAcao || l.proxima_acao,
              data_proxima_acao: extra.dataProximaAcao || l.data_proxima_acao,
              temperatura: extra.temperatura || l.temperatura,
              fechado: targetEtapa.is_won ? true : l.fechado,
            }
          : l,
      ),
    );

    setPendingMove(null);

    startTransition(async () => {
      try {
        await updateLeadEtapaAction(lead.id, targetEtapa.id, extra);
      } catch (err) {
        console.error("Erro ao atualizar etapa:", err);
        // Reverte se falhar
        setLeads(initialLeads);
      }
    });
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* BARRA DE FILTROS E SDR SMART FILA */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 shadow-xs">
        {/* Campo de Busca */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, email ou cidade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-700/80 bg-zinc-950/80 py-1.5 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        {/* Filtro por Consultor/SDR */}
        <div className="flex items-center gap-2">
          <select
            value={selectedConsultor}
            onChange={(e) => setSelectedConsultor(e.target.value)}
            className="rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="">Todos os Consultores / SDRs</option>
            {consultores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        {/* SDR Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveQuickFilter("todos")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              activeQuickFilter === "todos"
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            Todos ({leads.length})
          </button>

          {currentUserId && (
            <button
              onClick={() => setActiveQuickFilter("meus")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                activeQuickFilter === "meus"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Minha Fila
            </button>
          )}

          <button
            onClick={() => setActiveQuickFilter("sem_responsavel")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              activeQuickFilter === "sem_responsavel"
                ? "bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            <UserX className="h-3.5 w-3.5" />
            Sem Responsável
          </button>

          <button
            onClick={() => setActiveQuickFilter("sem_contato_24h")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              activeQuickFilter === "sem_contato_24h"
                ? "bg-amber-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            &gt;24h sem contato
          </button>

          <button
            onClick={() => setActiveQuickFilter("quentes")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              activeQuickFilter === "quentes"
                ? "bg-orange-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            Quentes
          </button>

          <button
            onClick={() => setActiveQuickFilter("incompletos")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              activeQuickFilter === "incompletos"
                ? "bg-purple-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            <FileQuestion className="h-3.5 w-3.5" />
            Incompletos
          </button>
        </div>
      </div>

      {/* PIPELINE KANBAN COM AS 12 COLUNAS E DRAG & DROP */}
      <div className="flex gap-3 overflow-x-auto pb-6 pt-1">
        {etapas.map((col) => {
          const colLeads = leadsByEtapa.get(col.id) ?? [];
          const colTotalVal = totalValueByEtapa.get(col.id) ?? 0;
          const isOver = dragOverStageId === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col)}
              className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-zinc-950/60 p-3 transition-colors duration-150 ${
                isOver
                  ? "border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/10"
                  : "border-zinc-800/90"
              }`}
            >
              {/* HEADER DA COLUNA */}
              <div className="mb-3 border-b border-zinc-800/80 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: col.cor }}
                    />
                    <h3 className="text-xs font-bold text-zinc-100 truncate" title={col.nome}>
                      {col.nome}
                    </h3>
                  </div>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                    {colLeads.length}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Volume potencial</span>
                  <span className="font-mono font-semibold text-zinc-400">
                    {colTotalVal > 0 ? formatCurrency(colTotalVal) : "R$ 0"}
                  </span>
                </div>
              </div>

              {/* LISTA DE CARDS DA COLUNA */}
              <div className="flex flex-1 flex-col space-y-2.5 overflow-y-auto">
                {colLeads.map((lead) => (
                  <CrmLeadCard
                    key={lead.id}
                    lead={lead}
                    etapas={etapas}
                    currentTime={currentTime}
                    onMoveStage={(l, target) => setPendingMove({ lead: l, targetEtapa: target })}
                    onDragStart={handleDragStart}
                  />
                ))}

                {colLeads.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-800/80 p-6 text-center text-xs text-zinc-600">
                    Nenhum lead nesta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE TRANSIÇÃO DE ETAPA */}
      {pendingMove && (
        <CrmStageMoveModal
          lead={pendingMove.lead}
          targetEtapa={pendingMove.targetEtapa}
          onConfirm={executeMove}
          onCancel={() => setPendingMove(null)}
          isPending={isPending}
        />
      )}
    </div>
  );
}
