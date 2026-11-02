import { NextResponse } from "next/server";
import { z } from "zod";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { getInstancia, tokenDaInstancia } from "@/lib/whatsapp/cloud-api/conexoes";
import { getMetaAppConfig } from "@/lib/whatsapp/cloud-api/config";
import { enviarMensagem } from "@/lib/whatsapp/cloud-api/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/whatsapp/cloud-api/validation";
export const runtime = "nodejs";
const schema = z.object({ instancia_id: uuid, id_envio: uuid, para: z.string().max(30).transform(v => v.replace(/\D/g, "")).pipe(z.string().regex(/^[1-9]\d{7,14}$/)), tipo: z.enum(["text", "template"]), texto: z.string().trim().max(4096).optional(), template_nome: z.string().regex(/^[a-z0-9_]{1,512}$/).optional(), idioma: z.string().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/).default("pt_BR") });
export async function POST(request: Request) {
    let a;
    try {
        a = await requireErpRouteAccess("whatsapp");
    }
    catch {
        return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
    }
    try {
        const b = schema.parse(await request.json());
        if (b.tipo === "text" ? !b.texto : !b.template_nome)
            throw new Error("Preencha o conteúdo da mensagem.");
        const i = await getInstancia(a.empresaAtiva.id, b.instancia_id);
        const token = tokenDaInstancia(i);
        const app = await getMetaAppConfig(i.app_meta_id);
        const db = createAdminClient();
        const reserva = await db.rpc("whatsapp_reservar_envio", { p_id: b.id_envio, p_empresa: i.empresa_id, p_instancia: i.id, p_usuario: a.usuario.id, p_para: b.para, p_tipo: b.tipo, p_conteudo: b.texto || null, p_template: b.template_nome || null });
        if (reserva.error)
            throw new Error("Envio não liberado. Confira conexão, destinatário de teste, modelo e limite mensal.");
        if (!reserva.data)
            return NextResponse.json({ error: "Este envio já foi processado ou está em andamento. Confira o histórico antes de repetir." }, { status: 409 });
        let wamid: string;
        try {
            wamid = await enviarMensagem(app, i.phone_number_id!, token, { to: b.para, type: b.tipo, ...(b.tipo === "text" ? { text: { body: b.texto } } : { template: { name: b.template_nome, language: { code: b.idioma } } }) });
        }
        catch {
            const { error } = await db.from("whatsapp_mensagens").update({ status: "unknown", erro: "Envio não confirmado. Confira o histórico e o painel Meta antes de repetir." }).eq("id", b.id_envio).eq("empresa_id", i.empresa_id).eq("instancia_id", i.id);
            if (error)
                return NextResponse.json({ error: "Falha ao registrar o resultado. Confira o histórico antes de repetir." }, { status: 503 });
            return NextResponse.json({ error: "A Meta não confirmou o envio. Confira token, permissões, destinatário de teste e janela de atendimento. Não repita sem conferir o histórico." }, { status: 502 });
        }
        // Webhook pode chegar antes da resposta Graph. Preservar eventual status mais avançado.
        const existing = await db.from("whatsapp_mensagens").select("id,status,erro").eq("empresa_id", i.empresa_id).eq("instancia_id", i.id).eq("wa_message_id", wamid).maybeSingle();
        if (existing.error)
            throw new Error("Envio aceito pela Meta; consulta de status falhou. Atualize o histórico.");
        if (existing.data) {
            const { error } = await db.from("whatsapp_mensagens").update({ conteudo: b.texto || null, template_nome: b.template_nome || null, tipo: b.tipo }).eq("id", existing.data.id).eq("empresa_id", i.empresa_id).eq("instancia_id", i.id);
            if (error)
                throw new Error("Envio aceito; atualização do histórico pendente.");
            await db.from("whatsapp_mensagens").update({ status: "reconciled", erro: "Status consolidado no histórico pelo identificador " + wamid }).eq("id", b.id_envio).eq("empresa_id", i.empresa_id);
        }
        else {
            const { error } = await db.from("whatsapp_mensagens").update({ wa_message_id: wamid, status: "accepted" }).eq("id", b.id_envio).eq("empresa_id", i.empresa_id).eq("instancia_id", i.id);
            if (error)
                throw new Error("Envio aceito pela Meta; gravação do identificador pendente. Não repita o envio.");
        }
        return NextResponse.json({ ok: true, wa_message_id: wamid });
    }
    catch (e) {
        return NextResponse.json({ error: e instanceof z.ZodError ? "Dados de envio inválidos." : e instanceof Error ? e.message : "Falha no envio" }, { status: 400 });
    }
}
