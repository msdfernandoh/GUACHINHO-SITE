import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { alternarAdministradoraAction } from "../administradoras-actions";

type Nested = { id: string; ativo?: boolean; status?: string; grupos_cotas?: { id: string }[] };

export default async function AdministradorasPage() {
  const db = await createClient();
  const { data, error } = await db.from("administradoras").select("id,nome,nome_fantasia,status,descricao_institucional,updated_at,tipos:administradora_tipos(id,ativo),modalidades:administradora_modalidades_comissao(id,ativo),grupos:grupos_consorcio(id,grupos_cotas(id)),programas:comissao_programas(id,status,ativo)").order("nome");
  const rows = (data ?? []) as unknown as Array<{id:string;nome:string;nome_fantasia:string|null;status:string;descricao_institucional:string|null;updated_at:string;tipos:Nested[];modalidades:Nested[];grupos:Nested[];programas:Nested[]}>;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Platform · Catálogo global</p><h1 className="mt-1 text-3xl font-bold">Administradoras</h1><p className="mt-2 text-slate-500">Raiz oficial de Tipos, Modalidades, Curvas, Programas, Grupos e Produtos.</p></div><Link href="/platform/administradoras/nova" className="rounded-xl bg-cyan-700 px-5 py-3 font-bold text-white">+ Nova Administradora</Link></header>
    {error && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">{error.message}</p>}
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="min-w-[1050px] w-full text-sm"><thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{["Administradora","Nome fantasia","Status","Tipos ativos","Modalidades ativas","Grupos","Produtos","Programas ativos","Atualizado em","Ações"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{rows.map(row=>{
      const produtos=row.grupos.reduce((total,g)=>total+(g.grupos_cotas?.length??0),0); const programas=row.programas.filter(p=>p.ativo&&["ATIVO","HOMOLOGADO"].includes(p.status??"")).length;
      return <tr key={row.id} className="border-b align-top"><td className="px-4 py-4 font-bold">{row.nome}</td><td className="px-4 py-4">{row.nome_fantasia||"—"}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.status==="ATIVA"?"bg-emerald-100 text-emerald-800":"bg-slate-200 text-slate-700"}`}>{row.status}</span></td><td className="px-4 py-4">{row.tipos.filter(x=>x.ativo).length}</td><td className="px-4 py-4">{row.modalidades.filter(x=>x.ativo).length}</td><td className="px-4 py-4">{row.grupos.length}</td><td className="px-4 py-4">{produtos}</td><td className="px-4 py-4">{programas}</td><td className="px-4 py-4">{new Date(row.updated_at).toLocaleDateString("pt-BR")}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Link href={`/platform/administradoras/${row.id}`} className="font-bold text-cyan-700">Gerenciar</Link><form action={alternarAdministradoraAction}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="nome" value={row.nome}/><input type="hidden" name="nome_fantasia" value={row.nome_fantasia??""}/><input type="hidden" name="descricao_institucional" value={row.descricao_institucional??""}/><input type="hidden" name="status" value={row.status==="ATIVA"?"INATIVA":"ATIVA"}/><button className="text-slate-600">{row.status==="ATIVA"?"Inativar":"Ativar"}</button></form></div></td></tr>;
    })}{!rows.length&&<tr><td colSpan={10} className="p-10 text-center text-slate-500">Nenhuma Administradora cadastrada.</td></tr>}</tbody></table></div>
  </div>;
}
