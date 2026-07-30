import { ContratacaoWizard } from "@/components/contratacao/contratacao-wizard";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canCreateProposta } from "@/lib/auth/permissions";

export default async function PropostaPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ public_token: string }>;
  searchParams: Promise<{ visualizacao?: string | string[] }>;
}) {
  const { public_token } = await params;
  const query = await searchParams;
  const usuario = await getUsuarioNegocio();
  const visualizacao = query.visualizacao === "resumida" ? "resumida" : "completa";

  return (
    <ContratacaoWizard
      publicToken={public_token}
      visualizacao={visualizacao}
      canGenerateLinks={canCreateProposta(usuario?.perfil)}
    />
  );
}
