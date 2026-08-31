import { ContratacaoWizard } from "@/components/contratacao/contratacao-wizard";

export default async function PropostaRascunhoPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; d?: string; s?: string }>;
}) {
  const { c, d, s } = await searchParams;
  return <ContratacaoWizard draftMode draftLink={c ? { c } : d && s ? { d, s } : undefined} />;
}
