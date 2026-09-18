import type { Metadata } from "next";
import { ParceirosLandingClient } from "@/components/public/parceiros-landing-client";

export const metadata: Metadata = {
  title: "Programa de Parceiros e Indicadores de Consórcio",
  description:
    "Faça parte do programa de parceiros da Gauchinho Consórcios e Racon. Indique clientes para consórcio imobiliário, veicular e pesados e receba comissões atrativas com acompanhamento em tempo real.",
  keywords: [
    "parceiros consórcio",
    "indicador de consórcio",
    "programa de afiliados consórcio",
    "comissão consórcio",
    "parceiro imobiliário sinop",
    "gauchinho parceiros",
  ],
  alternates: { canonical: "/parceiros" },
  openGraph: {
    title: "Programa de Parceiros e Indicadores de Consórcio",
    description:
      "Indique clientes e construa uma carteira de comissões sólida com a Gauchinho Consórcios e Racon.",
    url: "/parceiros",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Programa de Parceiros e Indicadores | Gauchinho Consórcios",
    description: "Seja um parceiro indicador de consórcio e ganhe comissões atrativas.",
  },
};

export default function ParceirosPage() {
  return <ParceirosLandingClient />;
}

