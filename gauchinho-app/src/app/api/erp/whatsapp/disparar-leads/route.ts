import { NextResponse } from "next/server";
import { z } from "zod";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInstancia, listarInstancias, tokenDaInstancia } from "@/lib/whatsapp/cloud-api/conexoes";
import { getMetaAppConfig } from "@/lib/whatsapp/cloud-api/config";
import { enviarMensagem } from "@/lib/whatsapp/cloud-api/client";
import { uuid } from "@/lib/whatsapp/cloud-api/validation";

export const runtime = "nodejs";
const schema = z.object({ lead_ids: z.array(uuid).min(1), template_nome: z.string().regex(/^[a-z0-9_]{1,512}$/), idioma: z.string().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/).default("pt_BR") });

export async function POST(request: Request) {
  try {
    const access = await requireErpRouteAccess("whatsapp");
    const body = schema.parse(await request.json());
    const instancia = (await listarInstancias(access.empresaAtiva.id)).find((item) => item.status === "conectado");
    if (!instancia) return NextResponse.json({ error: "Nenhuma instância WhatsApp conectada para esta empresa." }, { status: 409 });
    const completa = await getInstancia(access.empresaAtiva.id, instancia.id);
    const token = tokenDaInstancia(completa);
    const app = await getMetaAppConfig(completa.app_meta_id);
    const db = createAdminClient();
    const { data: leads, error: leadsError } = await db.from("leads").select("id,nome,whatsapp").eq("empresa_id", access.empresaAtiva.id).in("id", body.lead_ids);
    if (leadsError) throw new Error("Não foi possível carregar os leads desta etapa.");
    const byId = new Map((leads || []).map((lead) => [lead.id, lead]));
    const results: Array<{ lead_id: string; nome: string; ok: boolean; error?: string }> = [];
    for (const leadId of body.lead_ids) {
      const lead = byId.get(leadId);
      const para = lead?.whatsapp?.replace(/\D/g, "") || "";
      if (!lead || !/^[1-9]\d{7,14}$/.test(para)) {
        results.push({ lead_id: leadId, nome: lead?.nome || "Lead", ok: false, error: "Sem WhatsApp válido" });
        continue;
      }
      const idEnvio = crypto.randomUUID();
      const reserva = await db.rpc("whatsapp_reservar_envio", { p_id: idEnvio, p_empresa: completa.empresa_id, p_instancia: completa.id, p_usuario: access.usuario.id, p_para: para, p_tipo: "template", p_conteudo: null, p_template: body.template_nome });
      if (reserva.error || !reserva.data) {
        results.push({ lead_id: lead.id, nome: lead.nome, ok: false, error: "Envio não reservado pela cota/política do WhatsApp" });
        continue;
      }
      try {
        const wamid = await enviarMensagem(app, completa.phone_number_id!, token, { to: para, type: "template", template: { name: body.template_nome, language: { code: body.idioma } } });
        const { error } = await db.from("whatsapp_mensagens").update({ wa_message_id: wamid, status: "accepted" }).eq("id", idEnvio).eq("empresa_id", completa.empresa_id).eq("instancia_id", completa.id);
        if (error) throw new Error("Histórico pendente");
        results.push({ lead_id: lead.id, nome: lead.nome, ok: true });
      } catch {
        await db.from("whatsapp_mensagens").update({ status: "unknown", erro: "Envio não confirmado. Confira o histórico antes de repetir." }).eq("id", idEnvio).eq("empresa_id", completa.empresa_id).eq("instancia_id", completa.id);
        results.push({ lead_id: lead.id, nome: lead.nome, ok: false, error: "Meta não confirmou o envio" });
      }
    }
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Selecione ao menos um lead e um template válido." : error instanceof Error ? error.message : "Falha no disparo." }, { status: 400 });
  }
}
