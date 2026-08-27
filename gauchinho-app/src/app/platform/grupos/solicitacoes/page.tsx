import Link from "next/link";
import { decidirSolicitacaoGrupoAction } from "@/app/platform/grupos-actions";
import { createClient } from "@/lib/supabase/server";

type Solicitacao = {
  id: string;
  codigo_grupo: string;
  status: string;
  payload: Record<string, unknown>;
  criado_em: string;
  empresa?: { nome_fantasia?: string } | null;
  administradora?: { nome?: string } | null;
  grupo_id?: string | null;
};

export default async function SolicitacoesGruposPage() {
  const db = await createClient();
  const { data, error } = await db.from("catalogo_grupo_solicitacoes")
    .select("id,codigo_grupo,status,payload,criado_em,grupo_id,empresa:empresas(nome_fantasia),administradora:administradoras(nome)")
    .in("status", ["PENDENTE_PLATFORM", "EM_ANALISE", "DEVOLVIDA"])
    .order("criado_em", { ascending: true });
  const rows = (data ?? []) as unknown as Solicitacao[];

  return <div className="space-y-6">
    <div>
      <Link href="/platform/grupos" className="text-xs font-bold uppercase text-cyan-700">← Catálogo de grupos</Link>
      <h1 className="mt-2 text-3xl font-extrabold">Aprovações das franquias</h1>
      <p className="text-sm text-slate-500">A franquia continua operando com sua sugestão local enquanto a Platform confere e publica para a rede.</p>
    </div>
    {error ? <p className="rounded-lg bg-red-50 p-4 text-red-700">{error.message}</p> : null}
    {rows.length === 0 ? <p className="rounded-xl border bg-white p-8 text-center text-slate-500">Nenhuma alteração aguardando análise.</p> : null}
    <div className="space-y-4">{rows.map((row) => <article key={row.id} className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <div><h2 className="text-lg font-bold">Grupo {row.codigo_grupo} · {row.administradora?.nome ?? "—"}</h2><p className="text-sm text-slate-500">{row.empresa?.nome_fantasia ?? "Franquia"} · {new Date(row.criado_em).toLocaleString("pt-BR")}</p></div>
        <span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{row.status}</span>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(row.payload ?? {}).map(([chave, valor]) => <div key={chave} className="rounded-lg bg-slate-50 p-3"><dt className="text-[10px] font-bold uppercase text-slate-500">{chave.replaceAll("_", " ")}</dt><dd className="mt-1 break-words text-sm font-semibold">{Array.isArray(valor) ? valor.join(", ") : String(valor ?? "—")}</dd></div>)}</dl>
      <form action={decidirSolicitacaoGrupoAction} className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
        <input type="hidden" name="solicitacao_id" value={row.id} />
        <label className="min-w-64 flex-1 text-xs font-semibold">Observação<input name="observacao" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Obrigatória quando devolver ou rejeitar" /></label>
        <button name="decisao" value="DEVOLVER" className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-bold text-amber-800">Devolver</button>
        <button name="decisao" value="REJEITAR" className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Rejeitar</button>
        <button name="decisao" value="APROVAR" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Aprovar e publicar</button>
      </form>
    </article>)}</div>
  </div>;
}
