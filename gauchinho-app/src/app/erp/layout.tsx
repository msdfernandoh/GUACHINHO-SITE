import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { ErpSidebar } from "@/components/erp/erp-sidebar";
import { resolveErpUserAccess } from "@/lib/erp/erp-acesso";

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const { usuario, vinculos, empresaAtiva } = await getCurrentTenantContext();
  if (!usuario) redirect("/login?next=/erp");
  if (!empresaAtiva || !vinculos.some((v) => v.empresa_id === empresaAtiva.id)) redirect("/admin");
  const config = getErpSistemaConfig(empresaAtiva.configuracoes);
  if (!config.habilitado) redirect("/admin");
  const vinculo = vinculos.find((item) => item.empresa_id === empresaAtiva.id);
  const allowedAccess = resolveErpUserAccess(config, vinculo?.erp_modulos_visiveis);
  return <div className="flex min-h-screen bg-slate-100"><ErpSidebar config={config} empresaNome={empresaAtiva.nome_fantasia} allowedAccess={allowedAccess} /><main className="min-w-0 flex-1 overflow-auto bg-white p-6 text-slate-900">{children}</main></div>;
}
