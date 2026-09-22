import { notFound } from "next/navigation";
import { IndicacaoChat } from "@/components/app-indicador/indicacao-chat";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";

export default async function IndicacaoCurtaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const [{ codigo }, tenant] = await Promise.all([params, getResolvedTenant()]);
  const codigoCurto = codigo.trim().toUpperCase();
  if (!tenant || !/^[A-F0-9]{10}$/.test(codigoCurto)) notFound();

  const db = createAdminClient({ noStore: true });
  const { data: indicador } = await db
    .from("programa_indicadores")
    .select("id,participante:participantes_comerciais(nome)")
    .eq("empresa_id", tenant.empresaId)
    .eq("codigo_indicacao_curto", codigoCurto)
    .eq("ativo", true)
    .maybeSingle();
  if (!indicador) notFound();

  const participante = Array.isArray(indicador.participante) ? indicador.participante[0] : indicador.participante;
  return <IndicacaoChat codigoIndicacao={codigoCurto} nomeIndicador={participante?.nome ?? null} racon={isRaconModel(tenant.siteModel)} />;
}
