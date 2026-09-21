import type { Metadata } from "next";
import { ParceirosLandingClient } from "@/components/public/parceiros-landing-client";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getResolvedTenant();
  const brandName = tenant?.branding.nome_site || "Gauchinho Consórcios";
  const title = `Programa de Parceiros e Indicadores | ${brandName}`;
  const description = `Indique clientes para consórcio imobiliário e veicular e acompanhe suas comissões com ${brandName}.`;
  return {
    title,
    description,
    keywords: ["parceiros consórcio", "indicador de consórcio", "comissão consórcio", "parceiro imobiliário sinop"],
    alternates: { canonical: "/parceiros" },
    openGraph: { title, description, url: "/parceiros", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ParceirosPage() {
  const tenant = await getResolvedTenant();
  const racon = isRaconModel(tenant?.siteModel);
  return <ParceirosLandingClient racon={racon} brandName={racon ? (tenant?.branding.nome_site || "Racon Sinop") : "Gauchinho Consórcios"} />;
}
