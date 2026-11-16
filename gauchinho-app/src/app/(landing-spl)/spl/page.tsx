import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { estatisticasPublicas } from "@/lib/spl/repo";
import { SplLanding } from "@/components/spl/spl-landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Chaves para o Futuro · SPL Engenharia × Racon Consórcios" },
  description:
    "Programa para imobiliárias parceiras da SPL: quitação dos 70% na entrega das chaves com consórcio, carta contemplada, financiamento ou home equity.",
  alternates: { canonical: "/spl" },
  openGraph: {
    title: "Chaves para o Futuro · SPL × Racon",
    description: "Cadastre sua imobiliária e suba sua carteira SPL.",
    siteName: "Racon Consórcios · Franqueado Gauchinho",
    locale: "pt_BR",
    type: "website",
  },
};

export default async function SplPage() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const stats = await estatisticasPublicas(tenant.empresaId);
  return <SplLanding stats={stats} />;
}
