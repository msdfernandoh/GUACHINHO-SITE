import { NextResponse } from "next/server";
import { uploadDocumentoContratacao } from "@/lib/contratacoes-online/service";
import { isValidPublicToken } from "@/lib/contratacoes-online/public-token";
import type { TipoDocumentoContratacao } from "@/lib/contratacoes-online/types";

type Ctx = { params: Promise<{ token: string }> };

const TIPOS: TipoDocumentoContratacao[] = [
  "documento_foto",
  "cpf",
  "cartao_cnpj",
  "documento_responsavel",
  "cpf_responsavel",
  "comprovante_endereco",
  "comprovante_pix",
  "outro",
];

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    if (!isValidPublicToken(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }
    const form = await request.formData();
    const tipo = String(form.get("tipo_documento") ?? "") as TipoDocumentoContratacao;
    const file = form.get("arquivo");
    if (!TIPOS.includes(tipo)) {
      return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    }
    const result = await uploadDocumentoContratacao(token, tipo, file);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
