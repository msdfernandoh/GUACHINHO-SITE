import { notFound } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { canAccessErpRoute } from "@/lib/erp/erp-acesso";
import { getErpDashboardCompleto } from "@/lib/gestao/dashboards-service";
import { ErpDashboardView } from "@/components/erp/erp-dashboard-view";

export default async function ErpHomePage() {
  const { empresaAtiva, vinculos } = await getCurrentTenantContext();
  if (!empresaAtiva) notFound();

  const config = getErpSistemaConfig(empresaAtiva.configuracoes);
  const vinculo = (vinculos ?? []).find((item) => item.empresa_id === empresaAtiva.id);

  if (!canAccessErpRoute(config, vinculo?.erp_modulos_visiveis, "painel")) {
    notFound();
  }

  const initialData = await getErpDashboardCompleto(empresaAtiva.id, { periodo: "mes_atual" });

  return <ErpDashboardView initialData={initialData} />;
}

