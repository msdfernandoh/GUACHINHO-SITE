import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { ErpSidebar } from "@/components/erp/erp-sidebar";

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const { usuario, vinculos, empresaAtiva } = await getCurrentTenantContext();
  if (!usuario) redirect("/login?next=/erp");
  if (!empresaAtiva || !vinculos.some((v) => v.empresa_id === empresaAtiva.id)) redirect("/admin");
  const config = getErpSistemaConfig(empresaAtiva.configuracoes);
  if (!config.habilitado) redirect("/admin");
  return <div className="flex min-h-screen bg-slate-100"><ErpSidebar config={config} empresaNome={empresaAtiva.nome_fantasia} /><main className="min-w-0 flex-1 overflow-auto bg-white p-6 text-slate-900">{children}</main></div>;
}
