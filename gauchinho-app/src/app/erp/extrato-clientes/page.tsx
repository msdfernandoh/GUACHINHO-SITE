import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { obterHojeCuiaba } from "@/lib/erp/conta-corrente-periodos";
import { AcoesLinha } from "./acoes-linha";

export default async function ExtratosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { empresaAtiva } = await requireErpRouteAccess("extrato-clientes");
  const db = await createClient();
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes ?? "") ? params.mes! : obterHojeCuiaba().slice(0, 7);
  const pagina = Math.max(1, Math.min(100000, Number.parseInt(params.pagina ?? "1", 10) || 1));
  const busca = (params.busca ?? "").trim().slice(0, 100);
  const fila = params.visao === "reajustes";
  const { data, error } = await db.rpc("rpc_listar_extratos_clientes", {
    p_empresa_id: empresaAtiva.id, p_busca: busca, p_mes: fila ? mes : null, p_pagina: pagina,
  });
  if (error) throw new Error("Não foi possível carregar os extratos.");
  const lista = data as { total: number; clientes: { id: string; nome: string; quantidade: number; cotas: string; reajustou: boolean }[] };
  const ids = lista.clientes.map((c) => c.id);
  const [envios, totalEnviados] = await Promise.all([
    ids.length ? db.from("extratos_clientes_envios").select("cliente_id,enviado_em").eq("empresa_id", empresaAtiva.id).eq("competencia", mes + "-01").in("cliente_id", ids) : Promise.resolve({ data: [], error: null }),
    db.from("extratos_clientes_envios").select("cliente_id", { count: "exact", head: true }).eq("empresa_id", empresaAtiva.id).eq("competencia", mes + "-01"),
  ]);
  if (envios.error) throw new Error("Não foi possível consultar os envios.");
  const enviadosMes = totalEnviados.count ?? 0;
  const progresso = lista.total ? Math.min(100, Math.round((enviadosMes / lista.total) * 100)) : 0;
  const linkPagina = (n: number) => "?" + new URLSearchParams({ busca, mes, pagina: String(n), visao: fila ? "reajustes" : "todos" });
  const mesNome = new Date(mes + "-15T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 text-slate-900">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Relacionamento com o cliente</p>
          <h1 className="text-3xl font-black">Extrato de Clientes</h1>
          <p className="text-sm text-slate-500">Um PDF reúne todas as cotas de cada cliente. Copie a mensagem, baixe o PDF e envie pelo WhatsApp.</p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Clientes {fila ? "com reajuste" : "na carteira"}</p><p className="mt-1 text-2xl font-black">{lista.total}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Enviados em {mesNome}</p><p className="mt-1 text-2xl font-black text-emerald-700">{enviadosMes}</p></div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Pendentes</p><p className="mt-1 text-2xl font-black text-amber-600">{Math.max(0, lista.total - enviadosMes)}</p>
          <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: progresso + "%" }} /></div>
        </div>
      </section>

      <form className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
        <label className="text-sm font-semibold">Cliente, grupo ou cota
          <span className="mt-1 flex items-center gap-2 rounded-lg border px-3"><Search size={16} className="text-slate-400" /><input name="busca" defaultValue={busca} placeholder="Nome, grupo ou cota" className="w-full py-3 outline-none" /></span>
        </label>
        <label className="text-sm font-semibold">Mês de referência<input name="mes" type="month" defaultValue={mes} className="mt-1 block rounded-lg border p-3" /></label>
        <label className="text-sm font-semibold">Carteira<select name="visao" defaultValue={fila ? "reajustes" : "todos"} className="mt-1 block rounded-lg border p-3"><option value="todos">Todos os clientes</option><option value="reajustes">Reajustados no mês</option></select></label>
        <button className="rounded-lg bg-blue-800 px-6 py-3 font-bold text-white hover:bg-blue-900">Buscar</button>
      </form>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <ul className="divide-y">
          {lista.clientes.map((c) => {
            const enviado = !!envios.data?.some((e) => e.cliente_id === c.id);
            return (
              <li key={c.id} className="grid gap-3 p-4 hover:bg-slate-50 lg:grid-cols-[1.3fr_1fr_auto] lg:items-center">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-xl bg-blue-50 p-2 text-blue-800"><FileText size={18} /></span>
                  <div>
                    <p className="font-bold">{c.nome}</p>
                    <p className="text-xs text-slate-500">{c.quantidade} {c.quantidade === 1 ? "cota" : "cotas"}{c.reajustou ? " · reajuste no mês" : ""}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600">{c.cotas}</p>
                <AcoesLinha clienteId={c.id} mes={mes} enviadoInicial={enviado} />
              </li>
            );
          })}
        </ul>
        {!lista.clientes.length && <p className="p-5">Nenhum cliente encontrado neste filtro.</p>}
      </div>
      <nav className="flex items-center justify-end gap-4 text-sm" aria-label="Páginas de clientes">
        {pagina > 1 && <Link className="rounded-lg border px-3 py-2 font-semibold" href={linkPagina(pagina - 1)}>Anterior</Link>}
        <span>Página {pagina} de {Math.max(1, Math.ceil(lista.total / 25))}</span>
        {pagina * 25 < lista.total && <Link className="rounded-lg border px-3 py-2 font-semibold" href={linkPagina(pagina + 1)}>Próxima</Link>}
      </nav>
    </main>
  );
}
