import Link from "next/link";
import AdminDashboardPage from "@/app/admin/dashboard/page";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { listEnabledOperationalRoutes } from "@/lib/erp/erp-operational";

export default async function ErpHomePage() {
  const { empresaAtiva } = await getCurrentTenantContext();
  const config = getErpSistemaConfig(empresaAtiva?.configuracoes);
  const routes = listEnabledOperationalRoutes(config);
  return <div className="space-y-8"><header><p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-700">ERP Sistema</p><h1 className="mt-1 text-3xl font-bold text-slate-950">Central operacional</h1><p className="mt-2 max-w-3xl text-slate-500">Clientes, consultores, grupos, lances, comissoes e financeiro trabalhando sobre o mesmo cadastro tenant-aware.</p></header><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{routes.map((route) => <Link key={route.id} href={route.href} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><p className="text-xs font-bold uppercase tracking-widest text-blue-600">{route.section}</p><p className="mt-2 text-lg font-semibold text-slate-900">{route.label}</p></Link>)}</div><div className="border-t border-slate-200 pt-2"><AdminDashboardPage /></div></div>;
}
