import { notFound } from "next/navigation";
import { IndicacaoChat } from "@/components/app-indicador/indicacao-chat";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";

export default async function IndicacaoPorLinkPage({ params }: { params: Promise<{ codigo: string }> }) {
  const [{ codigo }, tenant] = await Promise.all([params, getResolvedTenant()]);
  if (!tenant || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(codigo)) notFound();

  const db = createAdminClient({ noStore: true });
  const { data: indicador } = await db
    .from("programa_indicadores")
    .select("id,participante:participantes_comerciais(nome)")
    .eq("empresa_id", tenant.empresaId)
    .eq("codigo_indicacao", codigo)
    .eq("ativo", true)
    .maybeSingle();
  if (!indicador) notFound();

  const participante = Array.isArray(indicador.participante) ? indicador.participante[0] : indicador.participante;
  return <IndicacaoChat codigoIndicacao={codigo} nomeIndicador={participante?.nome ?? null} racon={isRaconModel(tenant.siteModel)} />;
}
