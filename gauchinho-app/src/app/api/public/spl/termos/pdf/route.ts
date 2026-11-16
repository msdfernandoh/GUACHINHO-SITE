import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { contratanteDoTermo, getTermosSpl, termoDoModelo } from "@/lib/spl/termos";
import { preencherTermo } from "@/lib/spl/termos-preencher";
import { renderTermosPdf } from "@/lib/spl/termos-pdf";
import { imobiliariaPorToken } from "@/lib/spl/repo";

/**
 * PDF do termo do modelo de parceria. Com ?painel=<link do painel>, sai preenchido
 * com os dados e o aceite da imobiliária; com ?modelo=, sai em branco para leitura.
 */
export async function GET(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_termos_pdf", { limit: 20, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  const termos = await getTermosSpl();
  const params = new URL(request.url).searchParams;
  const painel = params.get("painel");
  const imob = painel ? await imobiliariaPorToken(ingress.empresaId, painel) : null;
  const modelo = imob?.modelo_parceria ?? params.get("modelo") ?? "GERADOR_OPORTUNIDADES";
  const modeloTexto = termoDoModelo(termos, modelo);
  if (!termos || !modeloTexto) return NextResponse.json({ error: "Não há termo publicado para este modelo." }, { status: 404 });
  const aceitou = !!imob?.termos_aceito_em && imob.termos_versao === termos.versao;
  const texto = preencherTermo(modeloTexto, {
    contratante: await contratanteDoTermo(ingress.empresaId),
    participante: imob
      ? { nome: imob.nome, cnpj: imob.cnpj, endereco: imob.endereco, email: imob.email, telefone: imob.telefone, responsavel: imob.responsavel }
      : null,
    campos: termos.campos,
    dataAceite: aceitou ? imob!.termos_aceito_em : null,
  });
  const pdf = await renderTermosPdf({
    versao: termos.versao,
    texto,
    responsavel: imob?.responsavel ?? null,
    aceite: aceitou ? { em: imob!.termos_aceito_em!, versao: imob!.termos_versao!, ip: imob!.termos_aceite_ip } : null,
  });
  const nome = imob ? `termo-parceria-${imob.nome}` : `termo-parceria-${modelo}`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${nome.normalize("NFD").replace(/[^\w-]+/g, "-").toLowerCase()}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
