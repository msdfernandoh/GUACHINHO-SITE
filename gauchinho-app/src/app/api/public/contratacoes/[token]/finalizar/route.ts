import { NextResponse } from "next/server";
import { finalizarContratacao } from "@/lib/contratacoes-online/service";
import { isValidPublicToken } from "@/lib/contratacoes-online/public-token";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    if (!isValidPublicToken(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }
    const row = await finalizarContratacao(token);
    return NextResponse.json({ ok: true, contratacao: row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
