import { notFound, redirect } from "next/navigation";
import { getCurrentErpAccess } from "@/lib/erp/erp-acesso-server";
import { resolveErpLandingHref } from "@/lib/erp/erp-acesso";
import { getErpDashboardCompleto } from "@/lib/gestao/dashboards-service";
import { ErpDashboardView } from "@/components/erp/erp-dashboard-view";

export default async function ErpHomePage() {
  const access = await getCurrentErpAccess();
  if (!access.usuario || !access.empresaAtiva) notFound();

  const landingHref = resolveErpLandingHref(access.allowedAccess);
  if (!landingHref) notFound();
  if (!access.allowedAccess.includes("painel")) redirect(landingHref);

  const { empresaAtiva } = access;

  const initialData = await getErpDashboardCompleto(empresaAtiva.id, { periodo: "mes_atual" });

  return <ErpDashboardView initialData={initialData} />;
}

