"use client";

import { useEffect, useState } from "react";
import { ResumoComercialDTO, ResumoFinanceiroDashDTO } from "@/lib/gestao/dashboards-service";

export default function AdminRelatoriosPage() {
  const [comercial, setComercial] = useState<ResumoComercialDTO | null>(null);
  const [financeiro, setFinanceiro] = useState<ResumoFinanceiroDashDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/admin/gestao/relatorios");
        if (res.ok) {
          const data = await res.json();
          setComercial(data.comercial);
          setFinanceiro(data.financeiro);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function handleExportCSV(tipo: string) {
    let rows: string[][] = [];
    let filename = `relatorio-${tipo}-${new Date().toISOString().split("T")[0]}.csv`;

    if (tipo === "vendas") {
      rows = [
        ["Indicador", "Valor"],
        ["Vendas Totais", String(comercial?.vendas_totais || 0)],
        ["Credito Total Vendido", String(comercial?.credito_total_vendido || 0)],
        ["Taxa Conversao (%)", String(comercial?.taxa_conversao_lead_venda || 0)],
      ];
    } else if (tipo === "financeiro") {
      rows = [
        ["Indicador", "Valor (R$)"],
        ["Receita Prevista Franquia", String(financeiro?.receita_prevista_franquia || 0)],
        ["Receita Recebida Efetiva", String(financeiro?.receita_recebida_franquia || 0)],
        ["Saldo a Receber Franquia", String(financeiro?.saldo_a_receber_franquia || 0)],
        ["Repasses Previstos Participantes", String(financeiro?.repasses_previstos_participantes || 0)],
        ["Repasses Pagos Participantes", String(financeiro?.repasses_pagos_participantes || 0)],
        ["Saldo a Repassar Participantes", String(financeiro?.saldo_a_repassar_participantes || 0)],
        ["Saldos a Compensar", String(financeiro?.saldos_a_compensar || 0)],
        ["Saldo de Caixa Efetivo", String(financeiro?.saldo_caixa || 0)],
      ];
    } else {
      rows = [
        ["Indicador", "Valor"],
        ["Leads Totais", String(comercial?.leads_totais || 0)],
        ["Leads em Andamento", String(comercial?.leads_em_andamento || 0)],
        ["Propostas Totais", String(comercial?.propostas_totais || 0)],
      ];
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-slate-400">
        Carregando relatorios consolidados...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Relatórios Consolidados</h1>
        <p className="text-slate-500 mt-1">Visões gerenciais e exportação de dados comerciais, financeiros e operacionais.</p>
      </div>

      {/* SEÇÃO VENDAS E CRM */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Relatório de Produção Comercial</h2>
          <button
            onClick={() => handleExportCSV("vendas")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            Exportar CSV Vendas
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-500">Crédito Vendido</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(comercial?.credito_total_vendido || 0)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-500">Total de Vendas</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{comercial?.vendas_totais || 0}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-500">Total de Leads</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{comercial?.leads_totais || 0}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-500">Taxa de Conversão</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{comercial?.taxa_conversao_lead_venda}%</p>
          </div>
        </div>
      </div>

      {/* SEÇÃO FINANCEIRO E COMISSÕES */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Relatório Financeiro e Comissões</h2>
          <button
            onClick={() => handleExportCSV("financeiro")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            Exportar CSV Financeiro
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-500">Receita Efetiva Franquia</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(financeiro?.receita_recebida_franquia || 0)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-500">Repasses Pagos</p>
            <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(financeiro?.repasses_pagos_participantes || 0)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-500">Saldos a Compensar</p>
            <p className="text-lg font-bold text-amber-600 mt-1">{formatCurrency(financeiro?.saldos_a_compensar || 0)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-500">Saldo Atual do Caixa</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(financeiro?.saldo_caixa || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
