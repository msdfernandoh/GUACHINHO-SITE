import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { obterHojeCuiaba } from "@/lib/erp/conta-corrente-periodos";

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
  const envios = ids.length ? await db.from("extratos_clientes_envios").select("cliente_id,enviado_em")
    .eq("empresa_id", empresaAtiva.id).eq("competencia", mes + "-01").in("cliente_id", ids) : { data: [], error: null };
  if (envios.error) throw new Error("Não foi possível consultar os envios.");
  const linkPagina = (n: number) => "?" + new URLSearchParams({ busca, mes, pagina: String(n), visao: fila ? "reajustes" : "todos" });
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 text-slate-900">
      <h1 className="text-3xl font-black">Extrato de Clientes</h1>
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4">
        <label className="grow text-sm font-semibold">Cliente, grupo ou cota<input name="busca" defaultValue={busca} className="mt-1 block w-full rounded-lg border p-3" /></label>
        <label className="text-sm font-semibold">Mês de referência<input name="mes" type="month" defaultValue={mes} className="mt-1 block rounded-lg border p-3" /></label>
        <label className="text-sm font-semibold">Carteira<select name="visao" defaultValue={fila ? "reajustes" : "todos"} className="mt-1 block rounded-lg border p-3"><option value="todos">Todos os clientes</option><option value="reajustes">PDFs por reajuste no mês</option></select></label>
        <button className="rounded-lg bg-blue-800 px-5 py-3 font-bold text-white">Buscar</button>
      </form>
      <p className="text-sm text-slate-600">{lista.total} clientes · Um PDF reúne todas as cotas de cada cliente.</p>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr><th className="p-3">Cliente</th><th className="p-3">Grupos / cotas</th><th className="p-3">Envio do mês</th><th className="p-3">Extrato</th></tr></thead>
          <tbody className="divide-y">{lista.clientes.map((c) => <tr key={c.id}><th scope="row" className="p-3">{c.nome}</th><td className="max-w-sm p-3">{c.cotas}</td><td className="p-3">{envios.data?.some((e) => e.cliente_id === c.id) ? "Enviado" : "Pendente"}</td><td className="p-3"><Link className="font-bold text-blue-800 underline" href={`/erp/extrato-clientes/${c.id}?mes=${mes}`}>Abrir extrato e PDF</Link></td></tr>)}</tbody>
        </table>
        {!lista.clientes.length && <p className="p-5">Nenhum cliente encontrado neste filtro.</p>}
      </div>
      <nav className="flex items-center justify-end gap-4 text-sm" aria-label="Páginas de clientes">
        {pagina > 1 && <Link href={linkPagina(pagina - 1)}>Anterior</Link>}
        <span>Página {pagina} de {Math.max(1, Math.ceil(lista.total / 25))}</span>
        {pagina * 25 < lista.total && <Link href={linkPagina(pagina + 1)}>Próxima</Link>}
      </nav>
    </main>
  );
}
