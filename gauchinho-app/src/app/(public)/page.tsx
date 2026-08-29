import type { Metadata } from "next";
import { getSimuladorConfigsPublic } from "@/lib/simulador/config";
import { loadHomeConteudoDestaques, loadHomePageData } from "@/lib/home/load-home-data";
import { safeFetch } from "@/lib/home/safe-fetch";
import { getHomeModulosConfigPublic } from "@/server/config";
import { fetchHomeSorteioDestaque } from "@/lib/eventos-sorteio/public";
import { HomeV2Client } from "./home-v2-client";
import { DEFAULT_HOME_MODULOS } from "@/lib/config/home-modulos";
import { DEFAULT_HOME_OPORTUNIDADES } from "@/lib/config/defaults";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { InstitutionalTenantHome } from "@/components/public/institutional-tenant-home";

export const metadata: Metadata = {
  title: "Consórcios de Imóveis, Veículos, Caminhões e Máquinas",
  description:
    "Simule consórcio para imóvel, carro, moto, caminhão e máquinas. Compare parcelas, lance embutido, grupos e financiamento com orientação consultiva.",
  keywords: [
    "consórcio de imóvel",
    "consórcio de carro",
    "consórcio de caminhão",
    "consórcio de máquinas agrícolas",
    "simulador de consórcio",
    "lance embutido",
    "carta contemplada",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Gauchinho Consórcios e Soluções Financeiras",
    description:
      "Planejamento para imóveis, veículos, caminhões e máquinas com simulador e consultoria.",
    url: "/",
    type: "website",
    images: [
      {
        url: "/media/gauchinho-campanha.jpeg",
        width: 1200,
        height: 630,
        alt: "Gauchinho Consórcios e Soluções Financeiras",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gauchinho Consórcios",
    description: "Simule consórcios para imóveis, veículos, caminhões e máquinas.",
    images: ["/media/gauchinho-campanha.jpeg"],
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ modulo?: string }>;
}) {
  const tenant = await getResolvedTenant();
  const params = searchParams ? await searchParams : {};

  // Somente o modelo próprio da Gauchinho, com entitlement operacional explícito,
  // pode carregar o runtime legado. Demais modelos/tenants ficam institucionais.
  const usaModeloGauchinho = tenant?.siteModel?.codigo === "gauchinho_default";
  if (tenant && (!tenant.allowsLegacyOperationalData || !usaModeloGauchinho)) {
    return (
      <InstitutionalTenantHome
        branding={tenant.branding}
        siteModel={tenant.siteModel!}
        showModuloIndisponivel={params.modulo === "indisponivel"}
      />
    );
  }

  let simuladorConfigs;
  let conteudo;
  let homeData;
  let homeModulos;
  let sorteioDestaque;
  try {
    [simuladorConfigs, conteudo, homeData, homeModulos, sorteioDestaque] =
      await Promise.all([
        getSimuladorConfigsPublic(),
        loadHomeConteudoDestaques(),
        loadHomePageData(),
        getHomeModulosConfigPublic(),
        safeFetch(() => fetchHomeSorteioDestaque(), null),
      ]);
  } catch (err) {
    console.error("[HomePage] falha ao carregar dados:", err);
    simuladorConfigs = await getSimuladorConfigsPublic();
    conteudo = { casosDestaque: [], dicasDestaque: [], parceirosDestaque: [] };
    homeData = { cartasDestaque: [], imoveisDestaque: [], homeOportunidades: DEFAULT_HOME_OPORTUNIDADES };
    homeModulos = DEFAULT_HOME_MODULOS;
    sorteioDestaque = null;
  }

  return (
    <HomeV2Client
      simuladorConfigs={simuladorConfigs}
      conteudoDestaques={conteudo}
      homeModulos={homeModulos}
      cartasDestaque={homeData.cartasDestaque}
      imoveisDestaque={homeData.imoveisDestaque}
      homeOportunidades={homeData.homeOportunidades}
      sorteioDestaque={sorteioDestaque}
    />
  );
}
