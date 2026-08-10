"use client";

import { useEffect, useState } from "react";
import { AuditLogCentralRow } from "@/lib/gestao/auditoria-service";

export default function AdminAuditoriaPage() {
  const [logs, setLogs] = useState<AuditLogCentralRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moduloFilter, setModuloFilter] = useState("");

  useEffect(() => {
    loadData();
  }, [moduloFilter]);

  async function loadData() {
    try {
      setLoading(true);
      const url = moduloFilter
        ? `/api/admin/gestao/auditoria?modulo=${encodeURIComponent(moduloFilter)}`
        : "/api/admin/gestao/auditoria";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.count || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Auditoria Central de Operações</h1>
        <p className="text-slate-500 mt-1">
          Rastreabilidade completa de ações operacionais, financeiras, de usuários e de sistema.
        </p>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-slate-700">Filtrar por Módulo:</label>
          <select
            value={moduloFilter}
            onChange={(e) => setModuloFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Módulos</option>
            <option value="crm">CRM & Leads</option>
            <option value="vendas">Vendas & Cotas</option>
            <option value="comissoes">Comissões & Motor</option>
            <option value="financeiro">Financeiro & Caixa</option>
            <option value="equipes">Equipes & Metas</option>
            <option value="tarefas">Tarefas Operacionais</option>
          </select>
        </div>
        <span className="text-sm text-slate-500 font-medium">Total de registros: {total}</span>
      </div>

      {/* TABELA DE LOGS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-medium">
            <tr>
              <th className="py-3 px-4">Data / Hora</th>
              <th className="py-3 px-4">Módulo</th>
              <th className="py-3 px-4">Ação</th>
              <th className="py-3 px-4">Entidade</th>
              <th className="py-3 px-4">Usuário</th>
              <th className="py-3 px-4">Correlação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">Carregando audit logs...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">Nenhum evento registrado.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-xs font-mono text-slate-500">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 px-4 font-semibold uppercase text-xs text-blue-600">{log.modulo}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">{log.acao}</td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-600">{log.entidade_tipo}</td>
                  <td className="py-3 px-4">{log.usuario?.nome || "Sistema / API"}</td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-400">
                    {log.correlation_id || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
