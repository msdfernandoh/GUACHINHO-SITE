import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { ordenarCotasPorProximidade } from "@/lib/erp/assembleias";
import { createAssembleiaAction, toggleAtencaoAssembleiaAction } from "@/app/erp/assembleias/actions";
import { listGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";

type Assembleia = { id: string; grupo_id: string; data_assembleia: string; numero_assembleia: number | null; pedra_sorteada: number; observacao: string | null; created_at: string };
type Grupo = { id: string; codigo_grupo: string; modalidade: string; administradora: string | null };
type CotaRow = { id: string; numero_cota: string | null; status: string; venda: { cliente_nome: string } | Array<{ cliente_nome: string }> | null };

export async function ErpAssembleiasPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { empresaAtiva } = await getCurrentTenantContext();
  const empresaId = empresaAtiva?.id ?? "";
  const supabase = await createClient();
  const [gruposAutorizados, { data: assembleias, error: assembleiasError }, { data: canWrite }] = await Promise.all([
    listGruposAutorizadosForEmpresa(empresaId),
    supabase.from("erp_assembleias_grupo").select("id,grupo_id,data_assembleia,numero_assembleia,pedra_sorteada,observacao,created_at").eq("empresa_id", empresaId).order("data_assembleia", { ascending: false }).order("created_at", { ascending: false }),
    supabase.rpc("can_write_tenant_internal", { p_empresa_id: empresaId }),
  ]);
  if (assembleiasError) throw new Error("Módulo Assembleias/Pedras ainda não está disponível neste ambiente.");
  // O catálogo autorizado reconcilia concessões da administradora com a configuração
  // local. A ausência de empresa_grupos_config mantém o default visível, em vez de
  // esvaziar o ERP de uma empresa que já possui a concessão ativa.
  const grupos = gruposAutorizados as Grupo[];
  const lista = (assembleias ?? []) as Assembleia[];
  const selecionada = lista.find((a) => a.id === params?.assembleia) ?? lista[0] ?? null;
  const grupoById = new Map(grupos.map((g) => [g.id, g]));
  let proximas: ReturnType<typeof ordenarCotasPorProximidade> = [];
  let atencoes = new Set<string>();
  if (selecionada) {
    const [{ data: cotas }, { data: marcadas }] = await Promise.all([
      supabase.from("cotas_definitivas").select("id,numero_cota,status,venda:vendas!inner(cliente_nome)").eq("empresa_id", empresaId).eq("grupo_id", selecionada.grupo_id),
      supabase.from("erp_assembleia_atencoes").select("cota_definitiva_id").eq("empresa_id", empresaId).eq("assembleia_id", selecionada.id),
    ]);
    proximas = ordenarCotasPorProximidade(((cotas ?? []) as CotaRow[]).map((c) => ({ id: c.id, numero_cota: c.numero_cota, status: c.status, cliente_nome: Array.isArray(c.venda) ? c.venda[0]?.cliente_nome ?? "Cliente" : c.venda?.cliente_nome ?? "Cliente" })), selecionada.pedra_sorteada);
    atencoes = new Set((marcadas ?? []).map((x) => x.cota_definitiva_id as string));
  }
  return <div className="space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Operação de consórcio</p><h1 className="text-3xl font-bold">Assembleias / Pedras</h1><p className="mt-1 text-slate-500">Histórico operacional por grupo e proximidade das cotas reais. A atenção não altera contemplação nem resultado oficial.</p></header>
    {canWrite === true && <form action={createAssembleiaAction} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5"><select name="grupo_id" required className="rounded-lg border bg-white px-3 py-2"><option value="">Grupo</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.codigo_grupo} · {g.modalidade}</option>)}</select><input name="data_assembleia" type="date" required className="rounded-lg border px-3 py-2"/><input name="numero_assembleia" type="number" min="1" placeholder="Nº assembleia" className="rounded-lg border px-3 py-2"/><input name="pedra_sorteada" type="number" min="0" required placeholder="Pedra sorteada" className="rounded-lg border px-3 py-2"/><button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Registrar assembleia</button><textarea name="observacao" placeholder="Observação operacional" className="rounded-lg border px-3 py-2 md:col-span-5"/></form>}
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]"><section className="rounded-xl border bg-white"><h2 className="border-b px-4 py-3 font-semibold">Histórico</h2><div className="max-h-[620px] overflow-auto">{lista.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhuma assembleia registrada.</p> : lista.map((a) => { const g = grupoById.get(a.grupo_id); return <Link key={a.id} href={`/erp/assembleias?assembleia=${a.id}`} className={`block border-b px-4 py-3 text-sm ${selecionada?.id === a.id ? "bg-blue-50" : "hover:bg-slate-50"}`}><p className="font-semibold">Grupo {g?.codigo_grupo ?? a.grupo_id.slice(0, 8)}</p><p className="text-slate-500">{a.data_assembleia} · Pedra {a.pedra_sorteada}{a.numero_assembleia ? ` · Assembleia ${a.numero_assembleia}` : ""}</p></Link>; })}</div></section>
    <section className="overflow-hidden rounded-xl border bg-white">{!selecionada ? <p className="p-8 text-center text-slate-500">Registre uma assembleia para analisar as cotas.</p> : <><div className="border-b p-4"><h2 className="font-semibold">Cotas mais próximas da pedra {selecionada.pedra_sorteada}</h2><p className="text-sm text-slate-500">Somente cotas definitivas do mesmo grupo e tenant.</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Cota</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Diferença</th><th className="px-4 py-3">Status real</th><th className="px-4 py-3">Atenção</th></tr></thead><tbody>{proximas.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhuma cota definitiva numerada neste grupo.</td></tr> : proximas.map((c) => { const marcada = atencoes.has(c.id); return <tr key={c.id} className={`border-t ${marcada ? "bg-amber-50" : ""}`}><td className="px-4 py-3 font-semibold">{c.numero_cota}</td><td className="px-4 py-3">{c.cliente_nome}</td><td className="px-4 py-3 font-bold">{c.distancia}</td><td className="px-4 py-3">{c.status}</td><td className="px-4 py-3">{canWrite === true ? <form action={toggleAtencaoAssembleiaAction}><input type="hidden" name="assembleia_id" value={selecionada.id}/><input type="hidden" name="cota_id" value={c.id}/><input type="hidden" name="marcada" value={String(marcada)}/><button className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${marcada ? "bg-amber-500 text-white" : "border border-amber-300 text-amber-800"}`}>{marcada ? "Em atenção" : "Marcar atenção"}</button></form> : marcada ? <span className="font-semibold text-amber-700">Em atenção</span> : "—"}</td></tr>; })}</tbody></table></div></>}</section></div>
  </div>;
}
