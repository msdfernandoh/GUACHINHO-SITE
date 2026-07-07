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
    "Consórcio, simulador, calculadoras e soluções financeiras no Rio Grande do Sul. Gauchinho Consórcios e Soluções Financeiras.",
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
