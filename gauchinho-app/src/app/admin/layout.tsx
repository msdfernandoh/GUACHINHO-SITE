import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";
import { AgendaCompromissosAlert } from "@/components/admin/agenda-compromissos-alert";
import type { AdminMenuKey } from "@/lib/admin/admin-menus";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioNegocio();
  if (!usuario) {
    redirect("/login?next=/admin");
  }

  const isSuperadmin = await isPlatformSuperadmin();
  const { empresaAtiva } = await getCurrentTenantContext();
  const erpEnabled = getErpSistemaConfig(empresaAtiva?.configuracoes).habilitado;

  return (
    <div className="dark flex min-h-screen bg-zinc-950 text-zinc-100">
      <AdminSidebar
        perfil={usuario.perfil}
        adminMenus={(usuario.admin_menus as AdminMenuKey[] | null) ?? null}
        isPlatformSuperadmin={isSuperadmin}
        erpEnabled={erpEnabled}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader nome={usuario.nome} perfil={usuario.perfil} />
        <AgendaCompromissosAlert />
        <main className="flex-1 overflow-auto bg-zinc-950 p-6 text-zinc-100">{children}</main>
      </div>
    </div>
  );
}
