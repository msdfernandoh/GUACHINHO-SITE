import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { validarCadastroVendedor } from "@/lib/spl/validacao";
import { cadastrarVendedor, imobiliariaPorConvite, imobiliariaPorToken } from "@/lib/spl/repo";
import { MODELOS_VENDEDOR, modeloPadraoVendedor, remuneracaoVendedorPermitida, type ModeloVendedor } from "@/lib/spl/types";
import { modeloDoConvite } from "@/lib/spl/convite";

/** Cadastro de vendedor: pelo link de convite (público) ou pelo painel (token da imobiliária). */
export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_vendedor", { limit: 20, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const imob = body.token
      ? await imobiliariaPorToken(ingress.empresaId, String(body.token))
      : await imobiliariaPorConvite(ingress.empresaId, String(body.convite ?? ""));
    if (!imob) return NextResponse.json({ error: "Convite inválido ou imobiliária indisponível." }, { status: 404 });
    // Só o painel da imobiliária pode escolher outro modelo para um vendedor específico.
    const pedido = String(body.modelo ?? "") as ModeloVendedor;
    // Pelo convite, o modelo vem do link assinado (quando a imobiliária escolhe por vendedor).
    const doConvite = !body.token ? modeloDoConvite(imob.token_painel, imob.codigo_convite, body.m, body.s) : null;
    const modelo =
      body.token && MODELOS_VENDEDOR.some((m) => m.value === pedido)
        ? pedido
        : (doConvite ?? modeloPadraoVendedor(imob.modelo_vendedores));
    if (!remuneracaoVendedorPermitida(imob.modelo_parceria, modelo)) {
      return NextResponse.json({ error: "Esse modelo passa do percentual da imobiliária." }, { status: 400 });
    }
    const parsed = validarCadastroVendedor(body, modelo);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const vendedor = await cadastrarVendedor(imob, parsed.data, modelo);
    return NextResponse.json({ ok: true, codigo: vendedor.codigo, nome: vendedor.nome, imobiliaria: imob.nome });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível cadastrar." }, { status: 400 });
  }
}
