import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
