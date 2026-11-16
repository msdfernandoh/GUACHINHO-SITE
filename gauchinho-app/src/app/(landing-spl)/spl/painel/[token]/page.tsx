import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { imobiliariaPorToken, listarClientes, listarEmpreendimentos, listarVendedores } from "@/lib/spl/repo";
import { SplPainel, type ConviteModelo } from "@/components/spl/spl-painel";
import { parametrosConviteModelo } from "@/lib/spl/convite";
import { caminhoConvite, caminhoPainel } from "@/lib/spl/links";
import { metadataAppSpl } from "@/lib/spl/app-metadata";
import { contratanteDoTermo, getTermosSpl, termoDoModelo } from "@/lib/spl/termos";
import { preencherTermo } from "@/lib/spl/termos-preencher";
import { opcoesRemuneracaoVendedor } from "@/lib/spl/types";
import { SplShell } from "@/components/spl/spl-ui";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const tenant = await getResolvedTenant();
  const imob = tenant ? await imobiliariaPorToken(tenant.empresaId, token) : null;
  const nome = imob?.nome ?? "Imobiliária";
  return metadataAppSpl({
    titulo: `${nome} · Painel SPL`,
    inicio: imob ? caminhoPainel(imob.nome, imob.token_painel) : "/spl",
    nomeApp: `${nome} · Painel SPL`,
    curto: "Painel SPL",
  });
}

export default async function SplPainelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const imob = await imobiliariaPorToken(tenant.empresaId, token);
  if (!imob) notFound();
  const [vendedores, clientes, empreendimentos, termos] = await Promise.all([
    listarVendedores(imob.id),
    listarClientes(imob.id),
    listarEmpreendimentos(tenant.empresaId),
    getTermosSpl(),
  ]);
  // Termo do modelo da imobiliária, já com os dados do cadastro.
  const modeloTermo = termoDoModelo(termos, imob.modelo_parceria);
  const termoPreenchido =
    termos && modeloTermo
      ? {
          versao: termos.versao,
          texto: preencherTermo(modeloTermo, {
            contratante: await contratanteDoTermo(tenant.empresaId),
            participante: imob,
            campos: termos.campos,
            dataAceite: imob.termos_versao === termos.versao ? imob.termos_aceito_em : null,
          }),
        }
      : null;
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
      <SplPainel
        imob={publica}
        token={token}
        convites={convites}
        termos={termoPreenchido} vendedores={vendedores} clientes={clientes} empreendimentos={empreendimentos} />
    </SplShell>
  );
}
