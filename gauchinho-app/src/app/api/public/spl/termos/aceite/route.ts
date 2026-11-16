import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { getTermosSpl, registrarAceiteTermos } from "@/lib/spl/termos";
import { imobiliariaPorToken } from "@/lib/spl/repo";

/** Aceite (ou novo aceite após uma nova versão) pelo painel da imobiliária. */
export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_termos_aceite", { limit: 10, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  const body = (await request.json().catch(() => ({}))) as { token?: string; versao?: string; aceito?: boolean };
  const imob = await imobiliariaPorToken(ingress.empresaId, String(body.token ?? ""));
  if (!imob) return NextResponse.json({ error: "Painel inválido." }, { status: 404 });
  const termos = await getTermosSpl();
  if (!termos) return NextResponse.json({ error: "Termo não publicado." }, { status: 404 });
  if (body.aceito !== true || body.versao !== termos.versao) {
    return NextResponse.json({ error: "Marque que leu e aceita a versão atual do termo." }, { status: 400 });
  }
  await registrarAceiteTermos(imob.id, ingress.empresaId, termos.versao, request);
  return NextResponse.json({ ok: true });
}
