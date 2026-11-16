import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { imobiliariaPorToken, listarClientes, listarEmpreendimentos, listarVendedores } from "@/lib/spl/repo";
import { SplPainel, type ConviteModelo } from "@/components/spl/spl-painel";
import { parametrosConviteModelo } from "@/lib/spl/convite";
import { caminhoConvite } from "@/lib/spl/links";
import { opcoesRemuneracaoVendedor } from "@/lib/spl/types";
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
  // Imobiliária que escolhe o modelo de cada vendedor recebe um link assinado por modelo.
  const base = caminhoConvite(imob.nome, imob.codigo_convite);
  const convites: ConviteModelo[] =
    imob.modelo_vendedores === "POR_VENDEDOR"
      ? opcoesRemuneracaoVendedor(imob.modelo_parceria)
          .filter((o) => o.permitido)
          .map((o) => ({
            modelo: o.value,
            titulo: `${o.label}${o.doVendedor ? ` · vendedor ${o.doVendedor.toLocaleString("pt-BR")}%` : ""}`,
            caminho: `${base}?${parametrosConviteModelo(imob.token_painel, imob.codigo_convite, o.value)}`,
          }))
      : [{ modelo: imob.modelo_vendedores, titulo: "Link para seus vendedores entrarem na sua rede", caminho: base }];
  const publica: Omit<typeof imob, "token_painel"> & { token_painel?: string } = { ...imob };
  delete publica.token_painel;
  return (
    <SplShell>
      <SplPainel imob={publica} token={token} convites={convites} vendedores={vendedores} clientes={clientes} empreendimentos={empreendimentos} />
    </SplShell>
  );
}
