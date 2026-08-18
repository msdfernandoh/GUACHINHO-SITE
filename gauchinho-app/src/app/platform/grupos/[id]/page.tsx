import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inativarProdutoAction, salvarModalidadesGrupoAction, salvarProdutoAction } from "../../grupos-catalogo-actions";

type Row = Record<string, unknown>;

function relationName(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? String((row as Row).nome ?? "—") : "—";
}

export default async function PlatformGrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: grupo } = await db.from("grupos_consorcio")
    .select("id,codigo_grupo,status,ativo,administradora_id,tipo_administradora_id,administradora:administradoras(nome),tipo:administradora_tipos(nome)")
    .eq("id", id).maybeSingle();
  if (!grupo) notFound();
  const [{ data: modalidades }, { data: habilitadas }, { data: produtos }, { data: regras }, { data: prontidao }] = await Promise.all([
    db.from("administradora_modalidades_comissao").select("id,nome,codigo").eq("administradora_id", grupo.administradora_id).eq("ativo", true).order("nome"),
    db.from("grupos_modalidades_disponiveis").select("administradora_modalidade_id,ativo,configuracao,created_at,updated_at").eq("grupo_id", id),
    db.from("grupos_cotas").select("id,valor_credito,status,ativo,grupo_cota_modalidade_valores(administradora_modalidade_id,valor_parcela,ativo)").eq("grupo_id", id).order("valor_credito"),
    db.from("comissao_regras_franquia").select("id,modalidade_comissao_id,versao,configuracao_homologada,ativa").eq("tipo_administradora_id", grupo.tipo_administradora_id).eq("ativa", true),
    db.from("catalogo_produtos_prontidao").select("grupo_cota_id,modalidades_exigidas,modalidades_configuradas,pronto_para_venda").eq("grupo_id", id),
  ]);
  const habilitada = new Map((habilitadas ?? []).map((x) => [x.administradora_modalidade_id, x.ativo]));
  const prontidaoProduto = new Map((prontidao ?? []).map((x) => [x.grupo_cota_id, x]));
  const modsAtivas = (modalidades ?? []).filter((m) => habilitada.get(m.id));
  const produtosProntos = (prontidao ?? []).filter((item) => item.pronto_para_venda).length;
  const salvarMods = salvarModalidadesGrupoAction.bind(null, id);
  return <div className="space-y-6">
    <Link href="/platform/grupos" className="text-sm font-medium text-cyan-700">← Grupos</Link>
    <header><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Catálogo global</p><h1 className="text-3xl font-bold">Grupo {grupo.codigo_grupo}</h1><p className="text-slate-500">{relationName(grupo.administradora)} · {relationName(grupo.tipo)}</p></header>
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-bold">Dados gerais</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Grupo</p><p className="mt-1 font-semibold">{grupo.codigo_grupo}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Administradora</p><p className="mt-1 font-semibold">{relationName(grupo.administradora)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Tipo</p><p className="mt-1 font-semibold">{relationName(grupo.tipo)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Status</p><p className="mt-1 font-semibold">{grupo.ativo ? "Ativo" : "Inativo"} · {grupo.status ?? "—"}</p></div>
      </div>
    </section>
    <form action={salvarMods} className="rounded-2xl border bg-white p-5 space-y-3">
      <h2 className="text-lg font-bold">Modalidades de pagamento disponíveis</h2>
      <p className="text-sm text-slate-500">A modalidade é escolhida na venda; o Grupo pode oferecer várias.</p>
      <div className="grid gap-2 md:grid-cols-3">{(modalidades ?? []).map((m) => <label key={m.id} className="flex gap-2 rounded-lg border p-3"><input type="checkbox" name="modalidades" value={m.id} defaultChecked={habilitada.get(m.id) === true}/><span>{m.nome}</span></label>)}</div>
      <button className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white">Salvar modalidades</button>
    </form>
    <section className="rounded-2xl border bg-white p-5 space-y-4">
      <div><h2 className="text-lg font-bold">Produtos comerciais / Cotas do Grupo</h2><p className="text-sm text-slate-500">Valores oficiais por modalidade. Seguro continua uma dimensão separada.</p></div>
      {(produtos ?? []).map((p) => {
        const valores = new Map((p.grupo_cota_modalidade_valores ?? []).filter((v) => v.ativo).map((v) => [v.administradora_modalidade_id, v.valor_parcela]));
        const salvar = salvarProdutoAction.bind(null, id, p.id); const inativar = inativarProdutoAction.bind(null, id, p.id);
        const pronto = prontidaoProduto.get(p.id);
        return <form action={salvar} key={p.id} className="grid gap-3 rounded-xl border p-4 lg:grid-cols-6">
          <label className="text-xs font-bold">Crédito<input className="mt-1 w-full rounded border p-2 text-sm" name="valor_credito" type="number" step="0.01" defaultValue={p.valor_credito}/></label>
          {modsAtivas.map((m) => <label key={m.id} className="text-xs font-bold">{m.nome}<input className="mt-1 w-full rounded border p-2 text-sm" name={`valor_${m.id}`} type="number" min="0.01" step="0.01" required defaultValue={String(valores.get(m.id) ?? "")}/></label>)}
          <label className="text-xs font-bold">Status<input className="mt-1 w-full rounded border p-2 text-sm" name="status" defaultValue={p.status}/></label>
          <div className="flex flex-col justify-end gap-2"><span className={pronto?.pronto_para_venda ? "text-xs font-bold text-emerald-700" : "text-xs font-bold text-amber-700"}>{pronto?.pronto_para_venda ? "Pronto para venda" : `${pronto?.modalidades_configuradas ?? 0}/${pronto?.modalidades_exigidas ?? modsAtivas.length} valores configurados`}</span><div className="flex gap-2"><button className="rounded bg-cyan-700 px-3 py-2 text-sm font-bold text-white">Salvar</button>{p.ativo ? <button formAction={inativar} className="rounded border px-3 py-2 text-sm font-bold">Inativar</button> : null}</div></div>
        </form>;
      })}
      <form action={salvarProdutoAction.bind(null, id, null)} className="grid gap-3 rounded-xl border border-dashed p-4 lg:grid-cols-6">
        <label className="text-xs font-bold">Novo crédito<input className="mt-1 w-full rounded border p-2 text-sm" name="valor_credito" type="number" min="0.01" step="0.01" required/></label>
        {modsAtivas.map((m) => <label key={m.id} className="text-xs font-bold">{m.nome}<input className="mt-1 w-full rounded border p-2 text-sm" name={`valor_${m.id}`} type="number" min="0.01" step="0.01" required/></label>)}
        <input type="hidden" name="status" value="Disponível"/><div className="flex items-end"><button className="rounded bg-cyan-700 px-3 py-2 text-sm font-bold text-white">Novo Produto / Cota</button></div>
      </form>
    </section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-bold">Validação de comissão</h2><div className="mt-3 space-y-2">{modsAtivas.map((m) => { const ok=(regras ?? []).some((r) => r.modalidade_comissao_id===m.id && r.configuracao_homologada); return <p key={m.id} className={ok ? "text-emerald-700" : "text-amber-700"}>{ok ? "✓" : "⚠"} {m.nome} — {ok ? "regra homologada encontrada" : "configuração pendente"}</p>; })}</div></section>
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-bold">Histórico e status de prontidão</h2>
      <p className="mt-1 text-sm text-slate-500">{modsAtivas.length} modalidades ativas · {produtosProntos}/{produtos?.length ?? 0} produtos prontos para venda.</p>
      <div className="mt-3 space-y-2">{(habilitadas ?? []).filter((item) => item.ativo).map((item) => { const config = (item.configuracao ?? {}) as Row; const modalidade = (modalidades ?? []).find((m) => m.id === item.administradora_modalidade_id); return <div key={item.administradora_modalidade_id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span className="font-semibold">{modalidade?.nome ?? item.administradora_modalidade_id}</span><span className="text-slate-500">Origem: {String(config.origem ?? "PLATFORM")} · atualizado {new Date(item.updated_at).toLocaleString("pt-BR")}</span></div>; })}</div>
    </section>
  </div>;
}
