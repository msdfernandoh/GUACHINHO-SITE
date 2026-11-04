import { redirect } from "next/navigation";
import { isRaconModel } from "@/lib/tenant/model-family";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";
import { AgendaCompromissosAlert } from "@/components/admin/agenda-compromissos-alert";
import type { AdminMenuKey } from "@/lib/admin/admin-menus";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { resolveAuthorizedErpUserAccess, resolveErpLandingHref } from "@/lib/erp/erp-acesso";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { TenantBrandProvider } from "@/components/tenant/tenant-brand-context";
import { GAUCHINHO_SLUG } from "@/lib/tenant/constants";
import { listarInstancias } from "@/lib/whatsapp/cloud-api/conexoes";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MensagemView } from "@/lib/whatsapp/cloud-api/types";
import { WhatsappFloatingDock } from "@/components/whatsapp/whatsapp-floating-dock";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { usuario, empresaAtiva, vinculoAtivo, permissoes } = await getCurrentTenantContext();
  if (!usuario) {
    redirect("/login?next=/admin");
  }
  if (!empresaAtiva || !vinculoAtivo) {
    redirect("/?acesso=empresa_negado");
  }
  // Indicadores pertencem ao tenant, mas não recebem permissões do backoffice.
  // O app atual resolve o participante e o programa tenant-aware; a antiga
  // /area-parceiro não representa o fluxo de indicação vigente.
  if (vinculoAtivo.papel?.codigo === "parceiro_comercial") {
    redirect("/app-indicador");
  }

  const erpConfig = getErpSistemaConfig(empresaAtiva.configuracoes);
  const erpAccess = resolveAuthorizedErpUserAccess(
    erpConfig,
    vinculoAtivo.erp_modulos_visiveis,
    { papelCodigo: vinculoAtivo.papel?.codigo, permissoes },
  );
  const erpHref = resolveErpLandingHref(erpAccess);
  const isSuperadmin = await isPlatformSuperadmin();
  const tenant = await getResolvedTenant();
  const isRacon = (tenant?.empresaId === empresaAtiva.id && isRaconModel(tenant.siteModel)) || isRaconModel(tenant?.siteModel);
  const primary = tenant?.branding.cor_primaria || "#0099dd";
  const brandName = tenant?.branding.nome_site || empresaAtiva.nome_fantasia;
  const brandLogo = tenant?.branding.logo_url || tenant?.siteModel?.logoPadraoUrl || null;
  const brandSecondary = tenant?.branding.cor_secundaria || String(tenant?.siteModel?.identidadeVisual.cor_secundaria || "#0c2340");
  const brandAccent = tenant?.branding.cor_destaque || String(tenant?.siteModel?.identidadeVisual.cor_destaque || primary);
  let whatsappDock: { instancia: Awaited<ReturnType<typeof listarInstancias>>[number]; mensagens: MensagemView[] } | null = null;
  if (erpAccess.includes("whatsapp")) {
    try {
      const instancias = await listarInstancias(empresaAtiva.id);
      const instancia = instancias.find((item) => item.status === "conectado") || instancias[0];
      if (instancia) {
        const historico = await createAdminClient().from("whatsapp_mensagens").select("id,instancia_id,direcao,contato_numero,contato_nome,tipo,conteudo,template_nome,status,erro,wa_message_id,criada_em").eq("empresa_id", empresaAtiva.id).eq("instancia_id", instancia.id).order("criada_em", { ascending: false }).limit(40);
        whatsappDock = { instancia, mensagens: (historico.data || []) as MensagemView[] };
      }
    } catch {
      whatsappDock = null;
    }
  }

  return (
    <TenantBrandProvider value={{ nome: brandName, slug: tenant?.slug || "", logoUrl: brandLogo, corPrimaria: primary, corSecundaria: brandSecondary, corDestaque: brandAccent, isGauchinho: !tenant?.parceiroSiteId && tenant?.slug === GAUCHINHO_SLUG, isRacon }}>
    <div
      className={isRacon ? "tenant-admin-racon flex min-h-screen bg-slate-50 text-slate-900" : "dark flex min-h-screen bg-zinc-950 text-zinc-100"}
      style={isRacon ? { "--tenant-primary": primary } as CSSProperties : undefined}
    >
      <AdminSidebar
        perfil={usuario.perfil}
        adminMenus={(usuario.admin_menus as AdminMenuKey[] | null) ?? null}
        isPlatformSuperadmin={isSuperadmin}
        erpHref={erpHref}
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
      {whatsappDock && <WhatsappFloatingDock instancia={whatsappDock.instancia} mensagens={whatsappDock.mensagens} />}
    </div>
    </TenantBrandProvider>
  );
}
