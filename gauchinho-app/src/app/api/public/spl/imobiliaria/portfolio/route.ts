import { NextResponse } from "next/server";
import { isValidBrazilianPhone, normalizePhoneForLead } from "@/lib/crm/upsert-lead";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { caminhoPortfolio } from "@/lib/spl/links";
import { cadastrarVendedor, imobiliariaPorToken, listarVendedores } from "@/lib/spl/repo";

export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_portfolio_responsavel", { limit: 15, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;

  const body = await request.json().catch(() => null);
  const imob = typeof body?.token === "string" ? await imobiliariaPorToken(ingress.empresaId, body.token) : null;
  if (!imob) return NextResponse.json({ error: "Painel inválido." }, { status: 404 });
  if (imob.status !== "PENDENTE" && imob.status !== "APROVADA") {
    return NextResponse.json({ error: "O portfólio está indisponível para a situação atual da imobiliária." }, { status: 409 });
  }
  const telefone = normalizePhoneForLead(imob.telefone);
  const nome = imob.responsavel?.trim();
  if (!nome || nome.length < 3 || !isValidBrazilianPhone(telefone)) {
    return NextResponse.json({ error: "Preencha o nome e o telefone do responsável em Editar dados da imobiliária." }, { status: 400 });
  }

  async function localizarResponsavel(imobiliariaId: string) {
    const vendedores = await listarVendedores(imobiliariaId);
    return vendedores.find((vendedor) => normalizePhoneForLead(vendedor.telefone) === telefone);
  }

  let vendedor = await localizarResponsavel(imob.id);
  if (!vendedor) {
    try {
      vendedor = await cadastrarVendedor(imob, { nome, telefone, email: imob.email || null, cpf: null, chave_pix: null, chave_pix_tipo: null }, "PROPRIO");
    } catch {
      vendedor = await localizarResponsavel(imob.id);
    }
  }
  if (!vendedor?.ativo) {
    const error = vendedor ? "O vendedor vinculado ao responsável está inativo." : "Não foi possível preparar o portfólio do responsável. Tente novamente.";
    return NextResponse.json({ error }, { status: 409 });
  }
  return NextResponse.json({ caminho: caminhoPortfolio(imob.nome, vendedor.codigo) });
}
