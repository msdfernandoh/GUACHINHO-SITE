import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { GAUCHINHO_SLUG } from "@/lib/tenant/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

const defaultMetadata: Metadata = {
  metadataBase: siteUrl ? new URL(`${siteUrl}/`) : undefined,
  title: {
    default: "Gauchinho Consórcios e Soluções Financeiras",
    template: "%s | Gauchinho",
  },
  description:
    "Consórcios, simuladores, calculadoras e soluções financeiras com atendimento online em todo o Brasil. Planeje imóveis, veículos, caminhões e máquinas.",
  category: "finance",
  keywords: [
    "consórcio",
    "simulador de consórcio",
    "consórcio de imóvel",
    "consórcio de veículos",
    "consórcio de caminhão",
    "consórcio de máquinas agrícolas",
    "carta de crédito",
    "lance embutido",
  ],
  verification: {
    google: "JoZmaDBhXbcdFfJKHd4uXE-ogA6NuOzLdFCKoAKll84",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Gauchinho Consórcios e Soluções Financeiras",
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
    images: ["/media/gauchinho-campanha.jpeg"],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getResolvedTenant();
  if (!tenant) return defaultMetadata;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const metadataBase = host ? new URL(`${protocol}://${host}/`) : siteUrl ? new URL(`${siteUrl}/`) : undefined;
  const nome = tenant.branding.nome_site || tenant.siteModel?.nome || "Consórcios";
  const descricao = tenant.branding.seo_descricao || tenant.branding.descricao_institucional || undefined;
  const logo = tenant.branding.logo_url || tenant.siteModel?.logoPadraoUrl || undefined;
  return {
    metadataBase,
    title: { default: tenant.branding.seo_titulo || nome, template: `%s | ${nome}` },
    description: descricao,
    category: "finance",
    robots: defaultMetadata.robots,
    openGraph: { type: "website", locale: "pt_BR", siteName: nome, ...(logo ? { images: [logo] } : {}) },
    twitter: { card: "summary_large_image", ...(logo ? { images: [logo] } : {}) },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getResolvedTenant();
  const isGauchinho = !tenant || tenant.slug === GAUCHINHO_SLUG;

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`min-h-full flex flex-col ${isGauchinho ? "" : "tenant-root-independent"}`}>
        {children}
      </body>
    </html>
  );
}
