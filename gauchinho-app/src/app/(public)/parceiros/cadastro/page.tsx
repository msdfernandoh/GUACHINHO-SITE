import { CadastroParceiroClient } from "@/components/public/parceiros-landing-client";
import { MODELOS_PROGRAMA_PARCEIROS, type ModeloParceiroId } from "@/lib/parceiros/modelos-programa";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";

export default async function CadastroParceiroPage({ searchParams }: { searchParams: Promise<{ modelo?: string }> }) {
  const [{ modelo }, tenant] = await Promise.all([searchParams, getResolvedTenant()]);
  const selecionado = modelo === "CONVERSAR_EQUIPE" ? "CONVERSAR_EQUIPE" : MODELOS_PROGRAMA_PARCEIROS.find((item) => item.id === modelo)?.id ?? "GERADOR_POSSIBILIDADES";
  const racon = isRaconModel(tenant?.siteModel);
  return <CadastroParceiroClient modeloInicial={selecionado as ModeloParceiroId | "CONVERSAR_EQUIPE"} racon={racon} brandName={racon ? (tenant?.branding.nome_site || "Racon Sinop") : "Gauchinho Consórcios"} />;
}
