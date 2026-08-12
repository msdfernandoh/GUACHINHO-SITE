import { ContratacaoWizard } from "@/components/contratacao/contratacao-wizard";

export default async function PropostaRascunhoPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; s?: string }>;
}) {
  const { d, s } = await searchParams;
  return <ContratacaoWizard draftMode draftLink={d && s ? { d, s } : undefined} />;
}
