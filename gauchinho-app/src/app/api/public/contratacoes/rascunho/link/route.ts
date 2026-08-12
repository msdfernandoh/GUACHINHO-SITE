import { NextResponse } from "next/server";
import { validarContratacaoDraftLink } from "@/lib/contratacoes-online/draft-link";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { d?: unknown; s?: unknown };
    return NextResponse.json({ draft: validarContratacaoDraftLink(body.d, body.s) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Link de simulação inválido." },
      { status: 400 },
    );
  }
}
