import type { Metadata } from "next";
import { ConteudoHero, ConteudoPageShell } from "@/components/conteudo/conteudo-hero";
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
    <ConteudoPageShell>
      <ConteudoHero
        eyebrow="Parceiros"
        title="Indicar cliente"
        subtitle="Preencha quem indicou uma vez e adicione quantos indicados precisar."
      />
      <IndicacaoForm origem={origem} />
    </ConteudoPageShell>
  );
}
