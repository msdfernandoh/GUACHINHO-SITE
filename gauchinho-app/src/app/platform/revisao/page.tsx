import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";

export const dynamic = "force-dynamic";

const datasets = {
  empresas: { title: "Master Franquias", table: "empresas", fields: "id,nome_fantasia,razao_social,slug,status,ativo,created_at", columns: ["nome_fantasia", "razao_social", "slug", "status", "ativo", "created_at"], tenant: false },
  usuarios: { title: "Usuários", table: "usuarios", fields: "id,nome,email,perfil,ativo,created_at", columns: ["nome", "email", "perfil", "ativo", "created_at"], tenant: false },
  leads: { title: "Leads", table: "leads", fields: "id,empresa_id,nome,email,whatsapp,status,created_at", columns: ["nome", "email", "whatsapp", "status", "created_at"], tenant: true },
  propostas: { title: "Propostas", table: "propostas", fields: "id,empresa_id,nome_cliente,tipo_bem,valor_credito,status,created_at", columns: ["nome_cliente", "tipo_bem", "valor_credito", "status", "created_at"], tenant: true },
  grupos: { title: "Grupos", table: "grupos_consorcio", fields: "id,empresa_origem_id,codigo_grupo,status,ativo,prazo_total,vagas_disponiveis,created_at", columns: ["codigo_grupo", "status", "ativo", "prazo_total", "vagas_disponiveis", "created_at"], tenant: true },
  vendas: { title: "Vendas", table: "vendas", fields: "id,empresa_id,cliente_nome,valor_credito,status,created_at", columns: ["cliente_nome", "valor_credito", "status", "created_at"], tenant: true },
} as const;

type Dataset = keyof typeof datasets;

export default async function RevisaoTecnicaPage({ searchParams }: { searchParams: Promise<{ tabela?: string; empresa?: string; pagina?: string }> }) {
  const db = await createClient();
  const allowed = (await isPlatformSuperadmin()) || Boolean((await db.rpc("is_platform_technical_reviewer")).data);
  if (!allowed) notFound();
  const params = await searchParams;
  const selected: Dataset = params.tabela && params.tabela in datasets ? params.tabela as Dataset : "empresas";
  const spec: { title: string; table: string; fields: string; columns: readonly string[]; tenant: boolean } = datasets[selected];
  const page = Math.min(1000, Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1));
  const admin = createAdminClient({ noStore: true });
  const { data: companies, error: companiesError } = await admin.from("empresas").select("id,nome_fantasia,slug").order("nome_fantasia");
  if (companiesError) throw new Error("Não foi possível carregar as empresas.");
  const companyId = companies?.some((c) => c.id === params.empresa) ? params.empresa : undefined;
  let query = admin.from(spec.table).select(spec.fields, { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  if (spec.tenant && companyId) query = query.eq(selected === "grupos" ? "empresa_origem_id" : "empresa_id", companyId);
  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const href = (key: Dataset, empresa?: string, pagina = 1) => `/platform/revisao?tabela=${key}${empresa ? `&empresa=${encodeURIComponent(empresa)}` : ""}&pagina=${pagina}`;
  return <section className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-700">Somente leitura</p><h1 className="mt-1 text-3xl font-bold">Revisão técnica do sistema</h1><p className="mt-2 text-sm text-slate-500">Dados existentes em produção. Esta área não oferece ações de alteração. Acesso restrito, com expiração automática.</p></div>
    <nav className="flex flex-wrap gap-2" aria-label="Conjuntos de dados">{(Object.keys(datasets) as Dataset[]).map((key) => <Link key={key} href={href(key, companyId)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${selected === key ? "bg-cyan-700 text-white" : "bg-white text-slate-700 dark:bg-slate-800 dark:text-white"}`}>{datasets[key].title}</Link>)}</nav>
    {spec.tenant && <form className="flex flex-wrap items-end gap-3"><input type="hidden" name="tabela" value={selected} /><label className="text-sm font-medium">Empresa<select name="empresa" defaultValue={companyId ?? ""} className="ml-2 rounded-lg border bg-white p-2 text-slate-900"><option value="">Todas</option>{companies?.map((c) => <option key={c.id} value={c.id}>{c.nome_fantasia}</option>)}</select></label><button className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white">Filtrar</button></form>}
    <div className="overflow-x-auto rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900"><div className="border-b px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{spec.title}: {count ?? 0} registros</div>{error ? <p className="p-4 text-red-700">Não foi possível carregar esta consulta.</p> : <table className="min-w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 dark:bg-slate-800">{spec.columns.map((col) => <th key={col} className="whitespace-nowrap px-4 py-3 font-semibold">{col.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-b last:border-0">{spec.columns.map((col) => <td key={col} className="max-w-xs truncate px-4 py-3">{row[col] === null || row[col] === undefined ? "—" : String(row[col])}</td>)}</tr>)}</tbody></table>}</div>
    <div className="flex items-center gap-3 text-sm">{page > 1 && <Link href={href(selected, companyId, page - 1)} className="rounded-lg border px-3 py-2">Anterior</Link>}<span>Página {page}</span>{(count ?? 0) > page * 50 && <Link href={href(selected, companyId, page + 1)} className="rounded-lg border px-3 py-2">Próxima</Link>}</div>
  </section>;
}
