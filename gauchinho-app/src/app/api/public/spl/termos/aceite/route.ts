import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { getTermosSpl, registrarAceiteTermos, termoDoModelo } from "@/lib/spl/termos";
import { imobiliariaPorToken } from "@/lib/spl/repo";

/** Aceite (ou novo aceite após uma nova versão) pelo painel da imobiliária. */
export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_termos_aceite", { limit: 10, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  const body = (await request.json().catch(() => ({}))) as { token?: string; modelo?: string; versao?: string; aceito?: boolean };
  const imob = await imobiliariaPorToken(ingress.empresaId, String(body.token ?? ""));
  if (!imob) return NextResponse.json({ error: "Painel inválido." }, { status: 404 });
  const termos = await getTermosSpl();
  if (!termos || !termoDoModelo(termos, imob.modelo_parceria)) return NextResponse.json({ error: "Termo não publicado." }, { status: 404 });
  if (body.aceito !== true || body.versao !== termos.versao || body.modelo !== imob.modelo_parceria) {
    return NextResponse.json({ error: "Marque que leu e aceita a versão atual do termo." }, { status: 400 });
  }
  try {
    await registrarAceiteTermos(imob.id, ingress.empresaId, imob.modelo_parceria, termos.versao, request);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível registrar o aceite." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
