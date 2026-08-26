import { redirect } from "next/navigation";
import { ErpSidebar } from "@/components/erp/erp-sidebar";
import { getCurrentErpAccess } from "@/lib/erp/erp-acesso-server";

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const { usuario, vinculos, empresaAtiva, config, allowedAccess } = await getCurrentErpAccess();
  if (!usuario) redirect("/login?next=/erp");
  if (!empresaAtiva || !vinculos.some((v) => v.empresa_id === empresaAtiva.id)) redirect("/admin");
  if (!config.habilitado) redirect("/admin");
  if (allowedAccess.length === 0) redirect("/admin");
  return <div className="flex min-h-screen bg-slate-100"><ErpSidebar config={config} empresaNome={empresaAtiva.nome_fantasia} allowedAccess={allowedAccess} /><main className="min-w-0 flex-1 overflow-auto bg-white p-6 text-slate-900">{children}</main></div>;
}
