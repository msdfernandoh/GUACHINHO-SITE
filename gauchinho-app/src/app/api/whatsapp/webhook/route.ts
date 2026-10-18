import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/whatsapp/cloud-api/signature";
import { getWebhookVerifyToken } from "@/lib/whatsapp/cloud-api/config";
import { getConexaoPorPhoneNumberId } from "@/lib/whatsapp/cloud-api/conexoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Verificação do webhook (Meta chama com hub.* na configuração).
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");
  try {
    if (mode === "subscribe" && token === getWebhookVerifyToken() && challenge) {
      return new NextResponse(challenge, { status: 200 });
    }
  } catch {
    // token não configurado
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Recebimento de mensagens e status. Roteia por phone_number_id -> empresa.
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  try {
    const entries = (body?.entry as unknown[]) ?? [];
    for (const entry of entries) {
      const changes = ((entry as Record<string, unknown>)?.changes as unknown[]) ?? [];
      for (const change of changes) {
        const value = (change as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
        if (!value) continue;
        const metadata = value.metadata as Record<string, unknown> | undefined;
        const phoneNumberId = metadata?.phone_number_id as string | undefined;
        if (!phoneNumberId) continue;

        const conexao = await getConexaoPorPhoneNumberId(phoneNumberId);
        if (!conexao) continue; // número não pertence a nenhuma franquia

        const contatos = (value.contacts as Array<Record<string, unknown>>) ?? [];
        const nomePorWa: Record<string, string> = {};
        for (const c of contatos) {
          const waId = c.wa_id as string | undefined;
          const nome = (c.profile as Record<string, unknown> | undefined)?.name as string | undefined;
          if (waId && nome) nomePorWa[waId] = nome;
        }

        // Mensagens recebidas
        const mensagens = (value.messages as Array<Record<string, unknown>>) ?? [];
        for (const m of mensagens) {
          const from = m.from as string | undefined;
          const waMessageId = m.id as string | undefined;
          const tipo = (m.type as string) ?? "text";
          const texto =
            tipo === "text"
              ? ((m.text as Record<string, unknown>)?.body as string) ?? null
              : null;
          await admin.from("whatsapp_mensagens").upsert(
            {
              empresa_id: conexao.empresa_id,
              conexao_id: conexao.id,
              direcao: "recebida",
              wa_message_id: waMessageId ?? null,
              contato_numero: from ?? "",
              contato_nome: from ? nomePorWa[from] ?? null : null,
              tipo,
              conteudo: texto,
              status: "received",
              payload: m,
            },
            { onConflict: "wa_message_id", ignoreDuplicates: true },
          );
        }

        // Atualizações de status (sent/delivered/read/failed)
        const statuses = (value.statuses as Array<Record<string, unknown>>) ?? [];
        for (const s of statuses) {
          const waMessageId = s.id as string | undefined;
          const status = s.status as string | undefined;
          if (!waMessageId || !status) continue;
          const erro =
            status === "failed"
              ? JSON.stringify((s.errors as unknown) ?? null)
              : null;
          await admin
            .from("whatsapp_mensagens")
            .update({ status, ...(erro ? { erro } : {}) })
            .eq("wa_message_id", waMessageId)
            .eq("empresa_id", conexao.empresa_id);
        }
      }
    }
  } catch (e) {
    // Nunca derrubar o webhook: logar e responder 200 p/ evitar reenvio em loop.
    console.error("[whatsapp webhook]", e);
  }

  return NextResponse.json({ ok: true });
}
