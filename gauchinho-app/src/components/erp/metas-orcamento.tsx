"use client";

import { useEffect, useState } from "react";

type Item = { id: string; competencia: string; categoria: string; tipo: string; valor_previsto_admin: number; observacoes: string | null };
const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function MetasOrcamento() {
  const [itens, setItens] = useState<Item[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let ativo = true;
    fetch("/api/admin/gestao/metas/orcamento").then(async (res) => {
      if (!res.ok) throw new Error(res.status === 403 ? "Orçamento disponível para quem tem acesso ao financeiro." : "Não foi possível consultar o orçamento.");
      const dados = await res.json();
      if (ativo) setItens(dados);
    }).catch((e) => { if (ativo) setErro(e.message); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);
  const meses = [...new Set(itens.map((i) => i.competencia))].sort().reverse();
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold text-slate-900">Orçamento de contas fixas e parcelas</h2>
    <p className="text-sm text-slate-600">Valores planejados por mês para acompanhar os gastos. O orçamento e os títulos em Contas a pagar representam a mesma lista e não são somados duas vezes.</p>
    {carregando && <p className="text-sm text-slate-500">Carregando orçamento…</p>}
    {erro && <p role="status" className="text-sm text-amber-800">{erro}</p>}
    {!carregando && !erro && !itens.length && <p className="text-sm text-slate-500">Nenhum orçamento cadastrado.</p>}
    {meses.map((mes) => {
      const linhas = itens.filter((i) => i.competencia === mes);
      const total = linhas.reduce((s, i) => s + Math.round(Number(i.valor_previsto_admin) * 100), 0) / 100;
      return <details key={mes} open className="overflow-hidden rounded-xl border border-indigo-200">
        <summary className="cursor-pointer bg-indigo-50 p-4 font-bold text-indigo-950">{mes.split("-").reverse().join("/")} · Meta de despesas: {moeda(total)}</summary>
        <table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Conta</th><th className="p-3">Tipo</th><th className="p-3 text-right">Planejado</th></tr></thead>
          <tbody>{linhas.map((i) => <tr key={i.id} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-900">{i.categoria}<p className="text-xs font-normal text-slate-500">{i.observacoes}</p></td><td className="p-3 text-slate-600">{i.tipo === "VARIAVEL" ? "Estimativa" : "Fixa / parcela"}</td><td className="p-3 text-right font-bold text-slate-900">{moeda(Number(i.valor_previsto_admin))}</td></tr>)}</tbody>
        </table>
      </details>;
    })}
    <a href="/erp/contas-pagar" className="inline-block text-sm font-bold text-blue-700 underline">Conferir títulos em Contas a pagar</a>
  </section>;
}
