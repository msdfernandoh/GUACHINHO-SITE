import { NextResponse } from "next/server";
import { requireCurrentTenantContext } from "@/lib/tenant/context";
import { trocarCodePorToken } from "@/lib/whatsapp/cloud-api/client";
import { salvarConexao } from "@/lib/whatsapp/cloud-api/conexoes";
import { WHATSAPP_GRAPH_BASE } from "@/lib/whatsapp/cloud-api/config";

export const runtime = "nodejs";

/**
 * Conclui o Embedded Signup: recebe { code, waba_id, phone_number_id } do client,
 * troca o code por token de usuário do sistema e salva a conexão da franquia (cifrada).
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireCurrentTenantContext();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { usuario, empresaAtiva } = ctx;

  let body: { code?: string; waba_id?: string; phone_number_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { code, waba_id, phone_number_id } = body;
  if (!code || !waba_id || !phone_number_id) {
    return NextResponse.json(
      { error: "Parâmetros obrigatórios: code, waba_id, phone_number_id" },
      { status: 400 },
    );
  }

  try {
    const { access_token, expires_in } = await trocarCodePorToken(code);

    // Busca número de exibição / nome verificado (best-effort).
    let numeroExibicao: string | null = null;
    let verifiedName: string | null = null;
    try {
      const res = await fetch(
        `${WHATSAPP_GRAPH_BASE}/${phone_number_id}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${access_token}` }, cache: "no-store" },
      );
      const info = await res.json();
      if (res.ok) {
        numeroExibicao = info?.display_phone_number ?? null;
        verifiedName = info?.verified_name ?? null;
      }
    } catch {
      // ignora — opcional
    }

    const tokenExpiraEm =
      typeof expires_in === "number" && expires_in > 0
        ? new Date(Date.now() + expires_in * 1000).toISOString()
        : null;

    await salvarConexao({
      empresaId: empresaAtiva.id,
      wabaId: waba_id,
      phoneNumberId: phone_number_id,
      token: access_token,
      numeroExibicao,
      verifiedName,
      tokenExpiraEm,
      conectadoPorId: usuario.id,
    });

    return NextResponse.json({ ok: true, numero: numeroExibicao, verifiedName });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao conectar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
