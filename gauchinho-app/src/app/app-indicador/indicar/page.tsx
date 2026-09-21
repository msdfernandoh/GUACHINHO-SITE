import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { IndicacaoChat } from "@/components/app-indicador/indicacao-chat";

export default async function IndicarNoAppPage() {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) redirect("/app-indicador/login");
  return <IndicacaoChat />;
}
