import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { validarCadastroCliente } from "@/lib/spl/validacao";
import { cadastrarCliente, imobiliariaPorToken, vendedorPorCodigo } from "@/lib/spl/repo";
import { getSplConfig } from "@/lib/spl/config-server";

/**
 * Cliente da carteira SPL. Pelo painel (token da imobiliária) ou pelo portfólio
 * do vendedor (código do vendedor). Proposta de consórcio marca a validade de 48h.
 */
export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_cliente", { limit: 30, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    let imob = null;
    let vendedor = null;
    if (body.vendedor) {
      const r = await vendedorPorCodigo(ingress.empresaId, String(body.vendedor));
      if (r) {
        imob = r.imobiliaria;
        vendedor = r.vendedor;
      }
    } else if (body.token) {
      imob = await imobiliariaPorToken(ingress.empresaId, String(body.token));
    }
    if (!imob) return NextResponse.json({ error: "Link inválido ou imobiliária indisponível." }, { status: 404 });

    const parsed = validarCadastroCliente(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const gerouProposta = body.proposta === true;
    const { validadePropostaHoras } = await getSplConfig();
    const expira = gerouProposta ? new Date(Date.now() + validadePropostaHoras * 3600_000).toISOString() : null;
    const dados = body.dados && typeof body.dados === "object" ? (body.dados as Record<string, unknown>) : {};

    const cliente = await cadastrarCliente({
      imob,
      vendedor,
      input: parsed.data,
      origem: vendedor ? "PORTFOLIO" : "PAINEL",
      dados,
      status: gerouProposta ? "PROPOSTA" : "NOVO",
      propostaExpiraEm: expira,
      host: request.headers.get("host"),
    });
    return NextResponse.json({ ok: true, id: cliente.id, expiraEm: expira });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível salvar." }, { status: 400 });
  }
}
