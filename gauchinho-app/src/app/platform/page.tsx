import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
export default async function PlatformDashboard() {
  const db = await createClient();
  const [empresas, admins, dominios, sites, planos, assinaturas] = await Promise.all([
    db.from("empresas").select("id,status,ativo,configuracoes"), db.from("administradoras").select("id,status"), db.from("empresa_dominios").select("id,verificado,ativo"), db.from("empresa_branding").select("id,status_publicacao"), db.from("saas_planos").select("id,status"), db.from("saas_assinaturas").select("id,status,valor_mensal"),
  ]);
  const rows = empresas.data ?? [];
  const metrics = [
    ["Empresas ativas", rows.filter((x) => x.ativo).length], ["Em treinamento", rows.filter((x) => x.status === "em_treinamento").length], ["ERP habilitados", rows.filter((x) => Boolean(((x.configuracoes as Record<string, unknown> | null)?.erp_sistema as { habilitado?: boolean } | undefined)?.habilitado)).length], ["Administradoras ativas", (admins.data ?? []).filter((x) => x.status === "ATIVA").length], ["Sites publicados", (sites.data ?? []).filter((x) => x.status_publicacao === "PUBLICADO").length], ["Domínios pendentes", (dominios.data ?? []).filter((x) => x.ativo && !x.verificado).length], ["Planos ativos", (planos.data ?? []).filter((x) => x.status === "ATIVO").length], ["Assinaturas ativas", (assinaturas.data ?? []).filter((x) => x.status === "ATIVA").length],
  ];
  return <div className="space-y-7"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-600">Dashboard Platform</p><h1 className="mt-1 text-3xl font-bold">Plataforma SaaS Master</h1><p className="mt-2 text-slate-500">Governança global de empresas, catálogo, sites, ERP e produto SaaS.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value]) => <div key={String(label)} className={card}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div><div className={card}><h2 className="text-lg font-semibold">Fluxo de governança</h2><div className="mt-4 grid gap-3 md:grid-cols-4">{[["Master Franquias","/platform/empresas"],["Catálogo Global","/platform/administradoras"],["Sites & Portais","/platform/sites"],["Planos e ERP","/platform/planos"]].map(([x,href]) => <Link className="rounded-xl bg-slate-100 p-4 font-medium hover:bg-cyan-50 dark:bg-slate-800" key={x} href={href}>{x} →</Link>)}</div></div></div>;
}
