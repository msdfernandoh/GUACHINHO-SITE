import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { lerConvite } from "@/lib/contempladas/acesso";
import { Card, Shell } from "@/components/contempladas/ui";
import { CadastroConvite } from "@/components/contempladas/cadastro";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Cadastro · Cotas Contempladas" }, robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const { token } = await params;
  const convite = await lerConvite(tenant.empresaId, token);
  return (
    <Shell titulo="Cadastro" sub="Portal de cotas contempladas">
      {convite ? (
        <CadastroConvite token={token} papel={convite.papel} />
      ) : (
        <Card className="mx-auto max-w-sm text-center">Link expirado ou inválido. Peça um novo ao administrador de cotas.</Card>
      )}
    </Shell>
  );
}
