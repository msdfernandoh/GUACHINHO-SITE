import { redirect } from "next/navigation";
import { ErpSidebar } from "@/components/erp/erp-sidebar";
import { getCurrentErpAccess } from "@/lib/erp/erp-acesso-server";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const { usuario, vinculos, empresaAtiva, config, allowedAccess } = await getCurrentErpAccess();
  if (!usuario) redirect("/login?next=/erp");
  if (!empresaAtiva || !vinculos.some((v) => v.empresa_id === empresaAtiva.id)) redirect("/admin");
  if (!config.habilitado) redirect("/admin");
  if (allowedAccess.length === 0) redirect("/admin");
  const tenant = await getResolvedTenant();
  const brandName = tenant?.empresaId === empresaAtiva.id ? tenant.branding.nome_site : empresaAtiva.nome_fantasia;
  const brandLogo = tenant?.empresaId === empresaAtiva.id
    ? tenant.branding.logo_url || tenant.siteModel?.logoPadraoUrl || null
    : null;
  const brandPrimary = tenant?.empresaId === empresaAtiva.id
    ? tenant.branding.cor_primaria || String(tenant.siteModel?.identidadeVisual.cor_primaria || "#0066cc")
    : "#1d4ed8";
  return <div className="flex min-h-screen bg-slate-100"><ErpSidebar config={config} empresaNome={brandName} logoUrl={brandLogo} brandPrimary={brandPrimary} allowedAccess={allowedAccess} /><main className="min-w-0 flex-1 overflow-auto bg-white p-6 text-slate-900">{children}</main></div>;
}
