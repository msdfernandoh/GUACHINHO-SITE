import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMetaApps } from "@/lib/whatsapp/cloud-api/config";
import { verifyWebhookSignature } from "@/lib/whatsapp/cloud-api/signature";
import { ehPedidoDeDescadastro } from "@/lib/whatsapp/cloud-api/templates-shared";
import { aplicarStatusTemplate } from "@/lib/whatsapp/cloud-api/templates";
import { gravarContatosDoApp, gravarHistorico, type ContatoSync, type HistoricoBloco } from "@/lib/whatsapp/cloud-api/coexistencia";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { try {
    const p = request.nextUrl.searchParams;
    if (p.get("hub.mode") === "subscribe" && p.get("hub.challenge") && (await getMetaApps()).some(a => a.verifyToken && a.verifyToken === p.get("hub.verify_token")))
        return new NextResponse(p.get("hub.challenge"), { status: 200 });
}
catch { } return new NextResponse("Forbidden", { status: 403 }); }
type Msg = {
    id?: string;
    from?: string;
    to?: string;
    type?: string;
    text?: {
        body?: string;
    };
    timestamp?: string;
};
type Valor = {
    metadata?: {
        phone_number_id?: string;
    };
    messages?: Msg[];
    message_echoes?: Msg[];
    contacts?: {
        wa_id?: string;
        profile?: {
            name?: string;
        };
    }[];
    history?: HistoricoBloco[];
    state_sync?: ContatoSync[];
    event?: string;
    message_template_id?: number | string;
    message_template_name?: string;
    message_template_language?: string;
    reason?: string | null;
    statuses?: {
        id?: string;
        status?: string;
        recipient_id?: string;
        errors?: {
            code?: number;
        }[];
    }[];
};
export async function POST(request: NextRequest) {
    const raw = await request.text();
    if (raw.length > 2000000)
        return new NextResponse("Payload too large", { status: 413 });
    let apps;
    try {
        apps = (await getMetaApps()).filter(a => verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"), a.appSecret));
    }
    catch {
        return new NextResponse("Configuration unavailable", { status: 503 });
    }
    if (!apps.length)
        return new NextResponse("Invalid signature", { status: 401 });
    let body: {
        object?: string;
        entry?: {
            id?: string;
            changes?: {
                field?: string;
                value?: Valor;
            }[];
        }[];
    };
    try {
        body = JSON.parse(raw);
    }
    catch {
        return new NextResponse("Invalid JSON", { status: 400 });
    }
    if (body.object && body.object !== "whatsapp_business_account")
        return NextResponse.json({ ok: true });
    const db = createAdminClient();
    try {
        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                const v = change.value;
                // Status de template chega pela WABA (sem número): aprovado, rejeitado, pausado…
                if (change.field === "message_template_status_update") {
                    if (!v || !entry.id)
                        continue;
                    const dono = await db.from("whatsapp_instancias").select("id,empresa_id,app_meta_id").eq("waba_id", entry.id).limit(1).maybeSingle();
                    if (dono.error)
                        throw new Error("lookup");
                    const d = dono.data;
                    if (d && apps.some(a => d.app_meta_id ? a.id === d.app_meta_id : (a.id === null || a.appId === process.env.WHATSAPP_APP_ID)))
                        await aplicarStatusTemplate(entry.id, v);
                    continue;
                }
                const phone = v?.metadata?.phone_number_id;
                if (!v || !phone)
                    continue;
                const { data: i, error } = await db.from("whatsapp_instancias").select("id,empresa_id,app_meta_id").eq("phone_number_id", phone).maybeSingle();
                if (error)
                    throw new Error("lookup");
                if (!i || !apps.some(a => i.app_meta_id ? a.id === i.app_meta_id : (a.id === null || a.appId === process.env.WHATSAPP_APP_ID)))
                    continue;
                for (const [direcao, mensagens] of [["recebida", v.messages || []], ["enviada", v.message_echoes || []]] as const) {
                    for (const m of mensagens) {
                        if (!m.id || !(direcao === "recebida" ? m.from : m.to))
                            continue;
                        const contato = direcao === "recebida" ? m.from! : m.to!;
                        const { error } = await db.from("whatsapp_mensagens").upsert({ empresa_id: i.empresa_id, instancia_id: i.id, direcao, wa_message_id: m.id, contato_numero: contato, contato_nome: v.contacts?.find(c => c.wa_id === contato)?.profile?.name || null, tipo: m.type || "text", conteudo: m.text?.body || null, status: direcao === "recebida" ? "received" : "sent" }, { onConflict: "wa_message_id", ignoreDuplicates: true });
                        if (error)
                            throw new Error("persist");
                        // "SAIR"/"PARAR": a pessoa sai de todos os envios automáticos da empresa.
                        if (direcao === "recebida" && ehPedidoDeDescadastro(m.text?.body)) {
                            const sair = await db.from("whatsapp_descadastros").upsert({ empresa_id: i.empresa_id, numero: contato, motivo: "Pediu para sair pelo WhatsApp" }, { onConflict: "empresa_id,numero", ignoreDuplicates: true });
                            if (sair.error)
                                throw new Error("descadastro");
                        }
                    }
                }
                // Coexistência: histórico e contatos do WhatsApp Business do celular.
                if (v.history?.length)
                    await gravarHistorico(i, v.history);
                if (v.state_sync?.length)
                    await gravarContatosDoApp(i, v.state_sync);
                for (const s of v.statuses || []) {
                    if (!s.id || !s.status || !["sent", "delivered", "read", "failed"].includes(s.status))
                        continue;
                    const { error } = await db.from("whatsapp_mensagens").upsert({ empresa_id: i.empresa_id, instancia_id: i.id, wa_message_id: s.id, direcao: "enviada", contato_numero: s.recipient_id || "", tipo: "text", status: "accepted" }, { onConflict: "wa_message_id", ignoreDuplicates: true });
                    if (error)
                        throw new Error("status insert");
                    const update = await db.rpc("whatsapp_atualizar_status", { p_empresa: i.empresa_id, p_instancia: i.id, p_wamid: s.id, p_status: s.status, p_erro: s.status === "failed" ? "Meta: falha de entrega (código " + (Number(s.errors?.[0]?.code) || 0) + ")." : null });
                    if (update.error)
                        throw new Error("status update");
                }
            }
        }
    }
    catch {
        return new NextResponse("Temporary processing failure", { status: 503 });
    }
    return NextResponse.json({ ok: true });
}
