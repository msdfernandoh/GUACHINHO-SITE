import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";
import { AgendaCompromissosAlert } from "@/components/admin/agenda-compromissos-alert";
import type { AdminMenuKey } from "@/lib/admin/admin-menus";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { TenantBrandProvider } from "@/components/tenant/tenant-brand-context";
import { GAUCHINHO_SLUG } from "@/lib/tenant/constants";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { usuario, empresaAtiva, vinculoAtivo } = await getCurrentTenantContext();
  if (!usuario) {
    redirect("/login?next=/admin");
  }
  if (!empresaAtiva || !vinculoAtivo) {
    redirect("/?acesso=empresa_negado");
  }

  const erpEnabled = getErpSistemaConfig(empresaAtiva?.configuracoes).habilitado;
  const isSuperadmin = await isPlatformSuperadmin();
  const tenant = await getResolvedTenant();
  const isRacon = tenant?.empresaId === empresaAtiva.id && tenant.siteModel?.codigo === "racon_inspired";
  const primary = tenant?.branding.cor_primaria || "#0099dd";
  const brandName = tenant?.branding.nome_site || empresaAtiva.nome_fantasia;
  const brandLogo = tenant?.branding.logo_url || tenant?.siteModel?.logoPadraoUrl || null;
  const brandSecondary = tenant?.branding.cor_secundaria || String(tenant?.siteModel?.identidadeVisual.cor_secundaria || "#0c2340");
  const brandAccent = tenant?.branding.cor_destaque || String(tenant?.siteModel?.identidadeVisual.cor_destaque || primary);

  return (
    <TenantBrandProvider value={{ nome: brandName, slug: tenant?.slug || "", logoUrl: brandLogo, corPrimaria: primary, corSecundaria: brandSecondary, corDestaque: brandAccent, isGauchinho: tenant?.slug === GAUCHINHO_SLUG, isRacon }}>
    <div
      className={isRacon ? "tenant-admin-racon flex min-h-screen bg-slate-50 text-slate-900" : "dark flex min-h-screen bg-zinc-950 text-zinc-100"}
      style={isRacon ? { "--tenant-primary": primary } as CSSProperties : undefined}
    >
      <AdminSidebar
        perfil={usuario.perfil}
        adminMenus={(usuario.admin_menus as AdminMenuKey[] | null) ?? null}
        isPlatformSuperadmin={isSuperadmin}
        erpEnabled={erpEnabled}
        brandName={brandName}
        brandLogoUrl={brandLogo}
        brandPrimary={primary}
        lightTheme={isRacon}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader nome={usuario.nome} perfil={usuario.perfil} />
        <AgendaCompromissosAlert />
        <main className={isRacon ? "flex-1 overflow-auto bg-slate-50 p-6 text-slate-900" : "flex-1 overflow-auto bg-zinc-950 p-6 text-zinc-100"}>{children}</main>
      </div>
    </div>
    </TenantBrandProvider>
  );
}
