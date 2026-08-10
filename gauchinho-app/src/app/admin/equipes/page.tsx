"use client";

import { useEffect, useState } from "react";
import { EquipeRow } from "@/lib/gestao/equipes-service";

export default function AdminEquipesPage() {
  const [equipes, setEquipes] = useState<EquipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/gestao/equipes");
      if (res.ok) {
        const data = await res.json();
        setEquipes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nome) return;
    try {
      const res = await fetch("/api/admin/gestao/equipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, descricao }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao criar equipe");
      }
      setNome("");
      setDescricao("");
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Gestão de Equipes Comerciais</h1>
        <p className="text-slate-500 mt-1">Organização de times, gestores e membros operacionais do tenant.</p>
      </div>

      {/* FORM CRIAR EQUIPE */}
      <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Nova Equipe</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nome da Equipe</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Equipe Vendas Sul"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Atendimento região Porto Alegre e Serra"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors"
        >
          Criar Equipe
        </button>
      </form>

      {/* TABELA EQUIPES */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-medium">
            <tr>
              <th className="py-3 px-4">Nome da Equipe</th>
              <th className="py-3 px-4">Descrição</th>
              <th className="py-3 px-4">Gestor Responsável</th>
              <th className="py-3 px-4">Membros</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">Carregando equipes...</td>
              </tr>
            ) : equipes.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">Nenhuma equipe cadastrada.</td>
              </tr>
            ) : (
              equipes.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-900">{e.nome}</td>
                  <td className="py-3 px-4 text-slate-500">{e.descricao || "—"}</td>
                  <td className="py-3 px-4">{e.gestor?.nome || "Sem gestor"}</td>
                  <td className="py-3 px-4">{e.membros_count} participante(s)</td>
                  <td className="py-3 px-4">
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-semibold">
                      {e.status.toUpperCase()}
                    </span>
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
