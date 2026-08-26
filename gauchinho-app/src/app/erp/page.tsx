import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { getErpDashboardCompleto } from "@/lib/gestao/dashboards-service";
import { ErpDashboardView } from "@/components/erp/erp-dashboard-view";

export default async function ErpHomePage() {
  const { empresaAtiva } = await requireErpRouteAccess("painel");

  const initialData = await getErpDashboardCompleto(empresaAtiva.id, { periodo: "mes_atual" });

  return <ErpDashboardView initialData={initialData} />;
}

