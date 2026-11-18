import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { validarCadastroImobiliaria } from "@/lib/spl/validacao";
import { atualizarImobiliaria, imobiliariaPorToken } from "@/lib/spl/repo";
import { podeDefinirModeloParceria } from "@/lib/spl/types";

/** Edição dos dados da imobiliária pelo painel (token secreto do link). */
export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_imobiliaria_editar", { limit: 10, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  try {
    const form = await request.formData();
    const imob = await imobiliariaPorToken(ingress.empresaId, String(form.get("token") ?? ""));
    if (!imob) return NextResponse.json({ error: "Painel inválido." }, { status: 404 });
    const raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    if (!podeDefinirModeloParceria(imob.status, imob.modelo_parceria)) raw.modelo_parceria = imob.modelo_parceria;
    const parsed = validarCadastroImobiliaria(raw);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const logo = form.get("logo");
    const atualizada = await atualizarImobiliaria(imob, parsed.data, logo instanceof File ? logo : null);
    return NextResponse.json({ ok: true, nome: atualizada.nome });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível salvar." }, { status: 400 });
  }
}
