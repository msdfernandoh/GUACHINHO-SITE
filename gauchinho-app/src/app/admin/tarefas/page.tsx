"use client";

import { useEffect, useState } from "react";
import type { TarefaGestaoRow } from "@/lib/gestao/tarefas-service";

export default function AdminTarefasPage() {
  const [tarefas, setTarefas] = useState<TarefaGestaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<TarefaGestaoRow["prioridade"]>("media");
  const [dataLimite, setDataLimite] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/gestao/tarefas");
      if (res.ok) {
        const data = await res.json();
        setTarefas(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo) return;
    try {
      const res = await fetch("/api/admin/gestao/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          descricao,
          prioridade,
          data_limite: dataLimite ? `${dataLimite}T23:59:59.000Z` : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao criar tarefa");
      }
      setTitulo("");
      setDescricao("");
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro ao criar tarefa");
    }
  }

  async function handleStatusChange(id: string, status: TarefaGestaoRow["status"]) {
    try {
      const res = await fetch("/api/admin/gestao/tarefas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao atualizar status");
      }
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar status");
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Gestão Operacional de Tarefas</h1>
        <p className="text-slate-500 mt-1">Acompanhamento de tarefas, retornos, atividades e pendências da equipe.</p>
      </div>

      {/* FORM CRIAR TAREFA */}
      <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Nova Tarefa Operacional</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Título da Tarefa</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Retornar proposta de R$ 300 mil para cliente X"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Prioridade</label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as TarefaGestaoRow["prioridade"])}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Data Limite</label>
            <input
              type="date"
              value={dataLimite}
              onChange={(e) => setDataLimite(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors"
        >
          Criar Tarefa
        </button>
      </form>

      {/* LISTA TAREFAS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-medium">
            <tr>
              <th className="py-3 px-4">Tarefa</th>
              <th className="py-3 px-4">Prioridade</th>
              <th className="py-3 px-4">Data Limite</th>
              <th className="py-3 px-4">Alerta Atraso</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">Carregando tarefas...</td>
              </tr>
            ) : tarefas.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">Nenhuma tarefa pendente.</td>
              </tr>
            ) : (
              tarefas.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-900">{t.titulo}</td>
                  <td className="py-3 px-4 capitalize">{t.prioridade}</td>
                  <td className="py-3 px-4">{t.data_limite ? t.data_limite.split("T")[0] : "Sem prazo"}</td>
                  <td className="py-3 px-4">
                    {t.is_atrasada ? (
                      <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">ATRASADA</span>
                    ) : (
                      <span className="text-slate-400 text-xs">No prazo</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={t.status}
                      onChange={(e) => handleStatusChange(t.id, e.target.value as TarefaGestaoRow["status"])}
                      className="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
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
