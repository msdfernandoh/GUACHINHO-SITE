"use client";

import { useEffect, useState } from "react";
import { MetaCommercialRow } from "@/lib/gestao/metas-service";

export default function AdminMetasPage() {
  const [metas, setMetas] = useState<MetaCommercialRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [titulo, setTitulo] = useState("");
  const [indicador, setIndicador] = useState<any>("valor_credito_vendido");
  const [alvoTipo, setAlvoTipo] = useState<any>("empresa");
  const [periodoTipo, setPeriodoTipo] = useState<any>("mensal");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [valorMeta, setValorMeta] = useState<number>(100000);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/gestao/metas");
      if (res.ok) {
        const data = await res.json();
        setMetas(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !dataInicio || !dataFim) return;
    try {
      const res = await fetch("/api/admin/gestao/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          indicador,
          alvo_tipo: alvoTipo,
          periodo_tipo: periodoTipo,
          data_inicio: dataInicio,
          data_fim: dataFim,
          valor_meta: Number(valorMeta),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao criar meta");
      }
      setTitulo("");
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Motor de Metas Comerciais</h1>
        <p className="text-slate-500 mt-1">Configuração de objetivos por empresa, equipe, participante ou parceiro com apuração dinâmica.</p>
      </div>

      {/* FORM NOVA META */}
      <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Nova Meta Comercial</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Título da Meta</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Meta Crédito Agosto 2026"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Indicador</label>
            <select
              value={indicador}
              onChange={(e) => setIndicador(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="valor_credito_vendido">Crédito Vendido (R$)</option>
              <option value="quantidade_vendas">Quantidade de Vendas</option>
              <option value="propostas_criadas">Propostas Criadas</option>
              <option value="receita_prevista_franquia">Receita Prevista (Franquia)</option>
              <option value="receita_recebida">Receita Recebida (Efetiva)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Valor Alvo (Meta)</label>
            <input
              type="number"
              value={valorMeta}
              onChange={(e) => setValorMeta(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Âmbito / Alvo</label>
            <select
              value={alvoTipo}
              onChange={(e) => setAlvoTipo(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="empresa">Toda a Empresa (Tenant)</option>
              <option value="equipe">Equipe Específica</option>
              <option value="participante">Participante Comercial</option>
              <option value="parceiro">Organização Parceira</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors"
        >
          Salvar Meta
        </button>
      </form>

      {/* LISTA METAS E APURAÇÃO */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-medium">
            <tr>
              <th className="py-3 px-4">Meta</th>
              <th className="py-3 px-4">Indicador</th>
              <th className="py-3 px-4">Período</th>
              <th className="py-3 px-4">Objetivo (Meta)</th>
              <th className="py-3 px-4">Realizado</th>
              <th className="py-3 px-4">% Atingimento</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">Calculando apurações...</td>
              </tr>
            ) : metas.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">Nenhuma meta configurada.</td>
              </tr>
            ) : (
              metas.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-900">{m.titulo}</td>
                  <td className="py-3 px-4 capitalize">{m.indicador.replace(/_/g, " ")}</td>
                  <td className="py-3 px-4">{m.data_inicio} até {m.data_fim}</td>
                  <td className="py-3 px-4 font-medium">
                    {m.indicador.includes("valor") || m.indicador.includes("receita")
                      ? formatCurrency(m.valor_meta)
                      : m.valor_meta}
                  </td>
                  <td className="py-3 px-4 font-semibold text-blue-600">
                    {m.indicador.includes("valor") || m.indicador.includes("receita")
                      ? formatCurrency(m.valor_realizado || 0)
                      : m.valor_realizado || 0}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        (m.percentual_atingimento || 0) >= 100
                          ? "bg-emerald-100 text-emerald-700"
                          : (m.percentual_atingimento || 0) >= 50
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {m.percentual_atingimento || 0}%
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
