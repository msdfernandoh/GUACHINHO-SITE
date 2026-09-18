"use client";

import { formatCurrency } from "@/lib/utils/format";
import type { CrmConsultorPerformance } from "@/lib/crm/dashboard-query";
import { Trophy, TrendingUp, Users, CalendarCheck, Award, Flame, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function CrmPerformancePanel({
  performance,
}: {
  performance: CrmConsultorPerformance[];
}) {
  // Ordena por produção / volume de vendas
  const sorted = [...performance].sort((a, b) => b.valorFechado - a.valorFechado);

  const totalProducao = performance.reduce((acc, p) => acc + p.valorFechado, 0);
  const totalLeads = performance.reduce((acc, p) => acc + p.totalLeads, 0);
  const totalReunioes = performance.reduce((acc, p) => acc + p.reunioesRealizadas, 0);
  const mediaConversao = totalLeads > 0 ? (performance.reduce((acc, p) => acc + p.vendasFechadas, 0) / totalLeads) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* 1. CARDS RESUMO DO PAINEL */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Produção Total</span>
            <Trophy className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-emerald-300">{formatCurrency(totalProducao)}</p>
          <p className="mt-1 text-[10px] text-zinc-500">Volume fechado da equipe</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total de Leads</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-100">{totalLeads}</p>
          <p className="mt-1 text-[10px] text-zinc-500">Oportunidades distribuídas</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Reuniões Feitas</span>
            <CalendarCheck className="h-4 w-4 text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-100">{totalReunioes}</p>
          <p className="mt-1 text-[10px] text-zinc-500">Comparecimentos confirmados</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Média de Conversão</span>
            <TrendingUp className="h-4 w-4 text-teal-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-100">{mediaConversao.toFixed(1)}%</p>
          <p className="mt-1 text-[10px] text-zinc-500">Eficiência geral</p>
        </div>
      </div>

      {/* 2. TABELA DE PERFORMANCE DA EQUIPE */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-sm">
        <div className="border-b border-zinc-800 p-4">
          <h2 className="text-base font-bold text-zinc-100">Painel de Performance da Equipe</h2>
          <p className="text-xs text-zinc-400">
            Acompanhamento de volume, intensidade de reuniões e conversão por consultor/SDR
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-4 py-3">Posição / Membro</th>
                <th className="px-4 py-3 text-center">Leads na Carteira</th>
                <th className="px-4 py-3 text-center">Reuniões Feitas</th>
                <th className="px-4 py-3 text-center">Vendas Fechadas</th>
                <th className="px-4 py-3 text-right">Produção Fechada</th>
                <th className="px-4 py-3 text-center">Conversão</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {sorted.map((item, index) => (
                <tr key={item.id} className="hover:bg-zinc-800/40">
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        index === 0
                          ? "bg-amber-500/20 text-amber-300"
                          : index === 1
                          ? "bg-zinc-300/20 text-zinc-200"
                          : index === 2
                          ? "bg-amber-700/20 text-amber-400"
                          : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {index + 1}
                      </span>
                      <span>{item.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-zinc-200">
                    {item.totalLeads}
                  </td>
                  <td className="px-4 py-3 text-center text-purple-300">
                    {item.reunioesRealizadas}
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-300 font-bold">
                    {item.vendasFechadas}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                    {item.valorFechado > 0 ? formatCurrency(item.valorFechado) : "R$ 0"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="rounded bg-zinc-800 px-2 py-0.5 font-bold text-zinc-200">
                      {item.taxaConversao.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/crm/pipeline?srd=${item.id}`}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline"
                    >
                      Ver Pipeline
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}

              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    Nenhum dado de atividade comercial registrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
