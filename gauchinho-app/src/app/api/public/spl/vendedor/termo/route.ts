import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { acessoDashboardVendedorValido } from "@/lib/spl/acesso-dashboard-vendedor";
import { vendedorPorCodigo } from "@/lib/spl/repo";
import { dadosDoAceite, getTermoVendedorSpl } from "@/lib/spl/termos";

export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_vendedor_termos_aceite", { limit: 10, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  const body = (await request.json().catch(() => null)) as { codigo?: string; acesso?: string; modelo?: string; versao?: string; aceito?: boolean } | null;
  if (!body?.codigo || !body.acesso) return NextResponse.json({ error: "Link individual inválido." }, { status: 404 });
  const vinculo = await vendedorPorCodigo(ingress.empresaId, body.codigo);
  if (!vinculo || vinculo.imobiliaria.empresa_id !== ingress.empresaId ||
    !acessoDashboardVendedorValido(vinculo.imobiliaria.token_painel, vinculo.vendedor.id, body.acesso)) {
    return NextResponse.json({ error: "Link individual inválido." }, { status: 404 });
  }
  const { vendedor, imobiliaria } = vinculo;
  const termo = vendedor.modelo === "PROPRIO" ? null : await getTermoVendedorSpl(ingress.empresaId);
  if (!termo || body.modelo !== vendedor.modelo || body.versao !== termo.versao || body.aceito !== true) {
    return NextResponse.json({ error: "Confira o modelo e marque que aceita a versão atual do termo." }, { status: 400 });
  }
  const { data, error } = await createAdminClient().from("spl_vendedores")
    .update({ termos_versao: termo.versao, ...dadosDoAceite(request) })
    .eq("empresa_id", ingress.empresaId)
    .eq("imobiliaria_id", imobiliaria.id)
    .eq("id", vendedor.id)
    .eq("modelo", vendedor.modelo)
    .eq("ativo", true)
    .select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Não foi possível registrar o aceite. Atualize o painel e tente novamente." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
