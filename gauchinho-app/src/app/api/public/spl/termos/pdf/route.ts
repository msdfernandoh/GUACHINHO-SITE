import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { getTermosSpl } from "@/lib/spl/termos";
import { renderTermosPdf } from "@/lib/spl/termos-pdf";
import { imobiliariaPorToken } from "@/lib/spl/repo";
import { labelDe, MODELOS_PARCERIA } from "@/lib/spl/types";

/** PDF do termo. Com ?painel=<link do painel>, inclui os dados e o aceite da imobiliária. */
export async function GET(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_termos_pdf", { limit: 20, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  const termos = await getTermosSpl();
  if (!termos) return NextResponse.json({ error: "O termo de parceria ainda não foi publicado." }, { status: 404 });
  const painel = new URL(request.url).searchParams.get("painel");
  const imob = painel ? await imobiliariaPorToken(ingress.empresaId, painel) : null;
  // A cópia assinada traz a versão aceita; se o termo mudou depois, o PDF mostra a versão atual sem aceite.
  const aceitou = imob?.termos_aceito_em && imob.termos_versao === termos.versao;
  const pdf = await renderTermosPdf({
    versao: termos.versao,
    texto: termos.texto,
    imobiliaria: imob
      ? {
          nome: imob.nome,
          cnpj: imob.cnpj,
          responsavel: imob.responsavel,
          telefone: imob.telefone,
          email: imob.email,
          modelo: labelDe(MODELOS_PARCERIA, imob.modelo_parceria),
        }
      : null,
    aceite: aceitou ? { em: imob!.termos_aceito_em!, versao: imob!.termos_versao!, ip: imob!.termos_aceite_ip } : null,
  });
  const nome = imob ? `termo-parceria-spl-${imob.nome}` : "termo-parceria-spl";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${nome.normalize("NFD").replace(/[^\w-]+/g, "-").toLowerCase()}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
