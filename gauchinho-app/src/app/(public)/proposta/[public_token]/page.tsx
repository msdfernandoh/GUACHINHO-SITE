import { ContratacaoWizard } from "@/components/contratacao/contratacao-wizard";

export default async function PropostaPublicPage({
  params,
}: {
  params: Promise<{ public_token: string }>;
}) {
  const { public_token } = await params;
  return <ContratacaoWizard publicToken={public_token} />;
}
