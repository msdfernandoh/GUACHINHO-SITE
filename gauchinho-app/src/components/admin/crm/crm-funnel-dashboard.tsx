"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import type { CrmDashboardData } from "@/lib/crm/dashboard-query";
import {
  Users,
  Flame,
  CalendarCheck,
  CalendarClock,
  Briefcase,
  Trophy,
  Target,
  Percent,
  AlertTriangle,
  Clock,
  ArrowRight,
  UserPlus,
  Kanban,
  FileCheck2,
} from "lucide-react";
import { CrmFunnel3dVisual } from "./crm-funnel-3d-visual";

export function CrmFunnelDashboard({ data }: { data: CrmDashboardData }) {
  const { kpis, funil, alertas } = data;

  return (
    <div className="space-y-8">
      {/* 1. CARDS SUPERIORES DE INDICADORES (8 KPIS DE VENDAS) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
        {/* Leads no mês */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Leads no mês</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-100">{kpis.leadsNoMes}</p>
          <p className="mt-1 text-[11px] text-zinc-500">Mês corrente</p>
        </div>

        {/* Leads novos hoje */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-300">Novos hoje</span>
            <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-100">+{kpis.leadsNovosHoje}</p>
          <p className="mt-1 text-[11px] text-blue-300/70">Entrados hoje</p>
        </div>

        {/* Reuniões agendadas */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Reuniões agendadas</span>
            <CalendarClock className="h-4 w-4 text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-100">{kpis.reunioesAgendadas}</p>
          <p className="mt-1 text-[11px] text-zinc-500">No calendário</p>
        </div>

        {/* Reuniões realizadas */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Reuniões realizadas</span>
            <CalendarCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-100">{kpis.reunioesRealizadas}</p>
          <p className="mt-1 text-[11px] text-zinc-500">Concluídas</p>
        </div>

        {/* Oportunidades em negociação */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Em negociação</span>
            <Briefcase className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-amber-400">
            {formatCurrency(kpis.oportunidadesNegociacaoValor)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Crédito potencial</p>
        </div>

        {/* Vendas fechadas no mês */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-300">Vendas no mês</span>
            <Trophy className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-emerald-300">
            {formatCurrency(kpis.vendasFechadasMesValor)}
          </p>
          <p className="mt-1 text-[11px] text-emerald-400/70">Produção fechada</p>
        </div>

        {/* Meta mensal atingida */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Meta mensal</span>
            <Target className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-100">
            {kpis.metaMensalAtingida.toFixed(1)}%
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(100, kpis.metaMensalAtingida)}%` }}
            />
          </div>
        </div>

        {/* Taxa de conversão */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Conversão geral</span>
            <Percent className="h-4 w-4 text-teal-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-100">
            {kpis.taxaConversao.toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Leads → Fechamento</p>
        </div>
      </div>

      {/* 2. ÁREA DE ALERTAS COMERCIAIS ATIVOS */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Alertas e Fila Operacional
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link
            href="/admin/crm/pipeline?sem_responsavel=1"
            className="group rounded-lg border border-red-500/30 bg-red-950/20 p-3 transition hover:border-red-500/50 hover:bg-red-950/40"
          >
            <p className="text-[11px] font-medium text-red-300">Sem responsável</p>
            <p className="mt-1 text-2xl font-bold text-red-100">{alertas.leadsSemResponsavel}</p>
            <p className="mt-0.5 text-[10px] text-red-400/80 group-hover:underline">Distribuir fila →</p>
          </Link>

          <Link
            href="/admin/crm/pipeline?parados_dias=1"
            className="group rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 transition hover:border-amber-500/50 hover:bg-amber-950/40"
          >
            <p className="text-[11px] font-medium text-amber-300">Sem contato &gt;24h</p>
            <p className="mt-1 text-2xl font-bold text-amber-100">{alertas.leadsSemContato24h}</p>
            <p className="mt-0.5 text-[10px] text-amber-400/80 group-hover:underline">Ver parados →</p>
          </Link>

          <Link
            href="/admin/agenda"
            className="group rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 transition hover:border-blue-500/50 hover:bg-blue-950/40"
          >
            <p className="text-[11px] font-medium text-blue-300">Reuniões hoje</p>
            <p className="mt-1 text-2xl font-bold text-blue-100">{alertas.reunioesHoje}</p>
            <p className="mt-0.5 text-[10px] text-blue-400/80 group-hover:underline">Abrir agenda →</p>
          </Link>

          <Link
            href="/admin/agenda"
            className="group rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <p className="text-[11px] font-medium text-zinc-400">Reuniões atrasadas</p>
            <p className="mt-1 text-2xl font-bold text-zinc-200">{alertas.reunioesAtrasadas}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500 group-hover:underline">Reagendar →</p>
          </Link>

          <Link
            href="/admin/crm/pipeline?parados_dias=7"
            className="group rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <p className="text-[11px] font-medium text-zinc-400">Parados &gt;7 dias</p>
            <p className="mt-1 text-2xl font-bold text-zinc-200">{alertas.leadsParados7d}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500 group-hover:underline">Recuperar →</p>
          </Link>

          <Link
            href="/admin/crm/pipeline?somente_quentes=1"
            className="group rounded-lg border border-orange-500/30 bg-orange-950/20 p-3 transition hover:border-orange-500/50 hover:bg-orange-950/40"
          >
            <p className="text-[11px] font-medium text-orange-300">Quentes / Urgentes</p>
            <p className="mt-1 text-2xl font-bold text-orange-100">{alertas.leadsQuentesUrgentes}</p>
            <p className="mt-0.5 text-[10px] text-orange-400/80 group-hover:underline">Focar agora →</p>
          </Link>
        </div>
      </div>

      {/* 3. NOVO MÓDULO EXECUTIVO: FUNIL VISUAL 3D COM CRÉDITO, PARCELA E LEADS */}
      <CrmFunnel3dVisual data={data} />

      {/* 4. FUNIL VISUAL PROPORCIONAL (12 ETAPAS CANÔNICAS - VISÃO HORIZONTAL) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Funil Comercial de Vendas</h2>
            <p className="text-xs text-zinc-400">
              Distribuição dos leads e montante de crédito em cada uma das 12 fases
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/crm/pipeline"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500"
            >
              <Kanban className="h-4 w-4" />
              Ver Pipeline Kanban
            </Link>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {funil.map((etapa) => {
            const widthPct = Math.max(2, Math.min(100, etapa.percentual));
            return (
              <div key={etapa.id} className="group flex items-center gap-4 text-xs">
                {/* Nome e ordem */}
                <div className="w-48 shrink-0">
                  <Link
                    href={`/admin/crm/pipeline?etapa_id=${etapa.id}`}
                    className="flex items-center gap-2 font-medium text-zinc-300 hover:text-white"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: etapa.cor }}
                    />
                    <span className="truncate">{etapa.nome}</span>
                  </Link>
                </div>

                {/* Barra horizontal proporcional */}
                <div className="relative flex-1">
                  <div className="h-6 w-full overflow-hidden rounded-md bg-zinc-950">
                    <div
                      className="flex h-full items-center px-2 text-[10px] font-bold text-white transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: etapa.cor,
                        opacity: 0.9,
                      }}
                    >
                      {etapa.totalLeads > 0 ? etapa.totalLeads : ""}
                    </div>
                  </div>
                </div>

                {/* Valor acumulado, parcelas e contagem */}
                <div className="flex w-72 shrink-0 items-center justify-end gap-3 font-mono text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">
                    {etapa.totalLeads} {etapa.totalLeads === 1 ? "lead" : "leads"}
                  </span>
                  <span className="text-[11px] font-bold text-zinc-300">
                    {etapa.valorTotal > 0 ? formatCurrency(etapa.valorTotal) : "R$ 0"}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400">
                    {etapa.valorParcelaTotal > 0 ? formatCurrency(etapa.valorParcelaTotal) + "/m" : "R$ 0/m"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
