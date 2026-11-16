import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { imobiliariaPorToken, listarClientes, listarEmpreendimentos, listarVendedores } from "@/lib/spl/repo";
import { SplPainel } from "@/components/spl/spl-painel";
import { SplShell } from "@/components/spl/spl-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Painel da imobiliária · Portfólio SPL" }, robots: { index: false, follow: false } };

export default async function SplPainelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const imob = await imobiliariaPorToken(tenant.empresaId, token);
  if (!imob) notFound();
  const [vendedores, clientes, empreendimentos] = await Promise.all([
    listarVendedores(imob.id),
    listarClientes(imob.id),
    listarEmpreendimentos(tenant.empresaId),
  ]);
  const publica: Omit<typeof imob, "token_painel"> & { token_painel?: string } = { ...imob };
  delete publica.token_painel;
  return (
    <SplShell>
      <SplPainel imob={publica} token={token} vendedores={vendedores} clientes={clientes} empreendimentos={empreendimentos} />
    </SplShell>
  );
}
