import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { IndicacaoChat } from "@/components/app-indicador/indicacao-chat";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";

export default async function IndicarNoAppPage() {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) redirect("/app-indicador/login");
  const tenant = await getResolvedTenant();
  return <IndicacaoChat racon={isRaconModel(tenant?.siteModel)} />;
}
