import type { MetadataRoute } from "next";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tenant = await getResolvedTenant();
  const racon = isRaconModel(tenant?.siteModel);
  const brandName = tenant?.branding.nome_site || "Racon Sinop";
  return {
    id: "/app-indicador",
    name: racon ? `${brandName} Parceiros` : "Gauchinho Parceiros",
    short_name: racon ? "Racon Parceiros" : "Gauchinho",
    description: racon ? `Indicações, acompanhamento e comissões da ${brandName}.` : "Indicações, acompanhamento e comissões da Gauchinho Consórcios.",
    start_url: "/app-indicador",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: racon ? "#f4f8fc" : "#09090b",
    theme_color: racon ? "#0066cc" : "#d4a017",
    icons: (racon
      ? [
          { src: "/racon/favicon-racon.png", sizes: "512x512", type: "image/png", purpose: "any" as const },
        ]
      : [
          { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" as const },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" as const },
        ]) as MetadataRoute.Manifest["icons"],
  };
}
