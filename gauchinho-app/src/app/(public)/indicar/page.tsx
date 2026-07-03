import type { Metadata } from "next";
import { PublicPremiumHero } from "@/components/public/public-premium-hero";
import { simuladorShell } from "@/components/simulador/simulador-ui";
import { IndicacaoForm } from "@/components/public/indicacao-form";

export const metadata: Metadata = {
  title: "Indicar cliente | Gauchinho",
  description: "Indique um ou mais clientes para o Gauchinho Consórcios.",
};

export default async function IndicarPage({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string }>;
}) {
  const { origem } = await searchParams;

  return (
    <div className={simuladorShell}>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <PublicPremiumHero
          eyebrow="Gauchinho · Indicação"
          title="Indicar cliente"
          subtitle="Preencha quem indicou uma vez e adicione quantos indicados precisar."
        />
        <IndicacaoForm origem={origem} />
      </div>
    </div>
  );
}
