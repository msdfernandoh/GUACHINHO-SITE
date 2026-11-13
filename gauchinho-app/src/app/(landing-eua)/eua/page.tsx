import type { Metadata } from "next";
import { EuaLanding } from "@/components/eua/eua-landing";
import { fetchBcbUltimo } from "@/lib/indices-financeiros/bcb";
import { cambioValido } from "@/lib/eua-landing/calculos";
import { euaText, type EuaLang } from "@/lib/eua-landing/copy";
import { BCB_SERIE_DOLAR_VENDA, EUA_CONTATOS, EUA_ICONE_GAUCHINHO } from "@/lib/eua-landing/config";
import { carregarOportunidadesEua } from "@/lib/eua-landing/oportunidades";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ lang?: string | string[] }> };

async function langFrom(searchParams: PageProps["searchParams"]): Promise<EuaLang> {
  const { lang } = await searchParams;
  return (Array.isArray(lang) ? lang[0] : lang) === "en" ? "en" : "pt";
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const lang = await langFrom(searchParams);
  const title = euaText(lang, "metaTitle");
  const description = euaText(lang, "metaDescription");
  const ogTitle = euaText(lang, "ogTitle");
  const ogDescription = euaText(lang, "ogDescription");
  return {
    title: { absolute: `Racon Consórcios · ${title}` },
    description,
    alternates: { canonical: "/eua", languages: { "pt-BR": "/eua", en: "/eua?lang=en" } },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      siteName: "Racon Consórcios · Franqueado Gauchinho",
      locale: lang === "en" ? "en_US" : "pt_BR",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: ogTitle, description: ogDescription },
  };
}

export default async function EuaPage({ searchParams }: PageProps) {
  const [lang, dolar, oportunidades] = await Promise.all([
    langFrom(searchParams),
    fetchBcbUltimo(BCB_SERIE_DOLAR_VENDA),
    carregarOportunidadesEua().catch(() => []),
  ]);
  return (
    <EuaLanding
      initialLang={lang}
      cambio={cambioValido(dolar?.valor)}
      cambioData={dolar?.data ?? null}
      oportunidades={oportunidades}
      contatos={EUA_CONTATOS}
      iconeGauchinhoUrl={EUA_ICONE_GAUCHINHO}
      agoraIso={new Date().toISOString()}
    />
  );
}
