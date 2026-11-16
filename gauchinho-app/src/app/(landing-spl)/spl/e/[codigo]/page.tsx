import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { imobiliariaPorConvite } from "@/lib/spl/repo";
import { SplVendedorCadastro } from "@/components/spl/spl-vendedor-cadastro";
import { SplShell } from "@/components/spl/spl-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Cadastro de vendedor · Portfólio SPL" }, robots: { index: false } };

export default async function SplConvitePage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const imob = await imobiliariaPorConvite(tenant.empresaId, codigo);
  if (!imob) notFound();
  return (
    <SplShell>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <SplVendedorCadastro convite={imob.codigo_convite} imobiliaria={imob.nome} modelo={imob.modelo_vendedores} />
      </main>
    </SplShell>
  );
}
