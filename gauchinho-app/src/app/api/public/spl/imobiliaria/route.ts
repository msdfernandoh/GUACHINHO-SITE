import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { validarCadastroImobiliaria } from "@/lib/spl/validacao";
import { cadastrarImobiliaria } from "@/lib/spl/repo";
import { getTermosSpl, registrarAceiteTermos } from "@/lib/spl/termos";

export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_imobiliaria", { limit: 5, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  try {
    const form = await request.formData();
    const raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    const parsed = validarCadastroImobiliaria(raw);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    // Termo publicado: o aceite da versão atual é obrigatório no cadastro.
    const termos = await getTermosSpl();
    if (termos && (form.get("termos_aceito") !== "true" || form.get("termos_versao") !== termos.versao)) {
      return NextResponse.json({ error: "Leia e aceite o termo de parceria para concluir." }, { status: 400 });
    }
    const logo = form.get("logo");
    const imob = await cadastrarImobiliaria(ingress.empresaId, parsed.data, logo instanceof File ? logo : null);
    if (termos) await registrarAceiteTermos(imob.id, ingress.empresaId, termos.versao, request);
    return NextResponse.json({ ok: true, token: imob.token_painel, convite: imob.codigo_convite, nome: imob.nome });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível cadastrar." }, { status: 400 });
  }
}
