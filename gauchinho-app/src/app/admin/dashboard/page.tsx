"use client";

import { useEffect, useState } from "react";
import { ResumoExecutivoDTO } from "@/lib/gestao/dashboards-service";

export default function AdminDashboardPage() {
  const [resumo, setResumo] = useState<ResumoExecutivoDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/admin/gestao/dashboard");
        if (res.ok) {
          const data = await res.json();
          setResumo(data);
        }
      } catch (err) {
        console.error("Erro ao carregar resumo executivo:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="animate-pulse flex flex-col space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-32 bg-slate-200 rounded"></div>
            <div className="h-32 bg-slate-200 rounded"></div>
            <div className="h-32 bg-slate-200 rounded"></div>
            <div className="h-32 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Painel Executivo de Gestão</h1>
        <p className="text-slate-500 mt-1">
          Visão consolidada de produção comercial, comissões, caixa, metas e operações da franquia.
        </p>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Crédito Vendido Efetivado</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatCurrency(resumo?.total_credito_vendido || 0)}
          </p>

        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Vendas Efetivadas</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {resumo?.total_vendas_count || 0}
          </p>

        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Receita Efetiva Franquia</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {formatCurrency(resumo?.receita_recebida_franquia || 0)}
          </p>

        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Saldo Atual do Caixa</p>
          <p className={`text-2xl font-bold mt-2 ${(resumo?.saldo_caixa || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatCurrency(resumo?.saldo_caixa || 0)}
          </p>
        </div>
      </div>

      {/* RESUMO OPERACIONAL E METAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">CRM & Funil de Vendas</h2>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Leads Registrados</span>
            <span className="font-semibold text-slate-900">{resumo?.leads_count}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Propostas Geradas</span>
            <span className="font-semibold text-slate-900">{resumo?.propostas_count}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-600">Ticket Médio das Vendas</span>
            <span className="font-semibold text-slate-900">{formatCurrency(resumo?.ticket_medio || 0)}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Comissões & Repasses</h2>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Receita Prevista (Franquia)</span>
            <span className="font-semibold text-slate-900">{formatCurrency(resumo?.receita_prevista_franquia || 0)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Repasses Previstos (Participantes)</span>
            <span className="font-semibold text-slate-900">{formatCurrency(resumo?.repasses_previstos_participantes || 0)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-600">Repasses Pagos (Participantes)</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(resumo?.repasses_pagos_participantes || 0)}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Gestão Operacional</h2>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Tarefas Pendentes</span>
            <span className="font-semibold text-amber-600">{resumo?.tarefas_pendentes_count}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">Tarefas Atrasadas</span>
            <span className="font-semibold text-rose-600">{resumo?.tarefas_atrasadas_count}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-600">Atingimento Médio de Metas</span>
            <span className="font-semibold text-blue-600">{resumo?.metas_atingimento_medio}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
