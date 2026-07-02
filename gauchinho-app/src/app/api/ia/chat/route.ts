import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { DEFAULT_CONTATO, DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { DEFAULT_IA_CONFIG, type IaConfig } from "@/lib/config/ia-defaults";
import { buildIaSystemPrompt } from "@/lib/ia/system-prompt";
import { chatWithIaProvider } from "@/lib/ia/provider";
import { extrairLeadDaConversa } from "@/lib/ia/extrair-lead";
import {
  getOrCreateConversa,
  loadMensagens,
  saveMensagem,
  updateConversaLead,
} from "@/lib/ia/conversa-db";
import { resolveWhatsappOrigem } from "@/lib/whatsapp/resolve-origem";

const ORIGEM = "ia_chat";

type Body = {
  sessionId: string;
  message: string;
  paginaOrigem?: string;
  urlOrigem?: string;
};

const FALLBACK_UNAVAILABLE =
  "Assistente temporariamente indisponível. Fale com um especialista pelo WhatsApp ou use os atalhos abaixo.";

const FALLBACK_ERROR =
  "No momento não consegui responder automaticamente, mas posso te direcionar para um especialista.";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.sessionId?.trim() || !body.message?.trim()) {
      return NextResponse.json({ error: "sessionId e message obrigatórios" }, { status: 400 });
    }

    const iaConfig = await getConfigJsonPublic<IaConfig>("ia_config", DEFAULT_IA_CONFIG);
    if (!iaConfig.ativo) {
      return NextResponse.json({ error: "Chat desativado" }, { status: 403 });
    }

    const pagina = body.paginaOrigem ?? "/";
    const url = body.urlOrigem ?? pagina;

    let conversa;
    try {
      conversa = await getOrCreateConversa(body.sessionId.trim(), pagina, url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DB";
      if (/ia_conversas|does not exist|PGRST/i.test(msg)) {
        return NextResponse.json({
          reply: FALLBACK_UNAVAILABLE,
          providerUnavailable: true,
        });
      }
      throw e;
    }

    await saveMensagem(conversa.id, "user", body.message.trim());
    await registrarEvento({
      tipo_evento: "ia_mensagem_enviada",
      origem: ORIGEM,
      pagina,
      entidade_id: conversa.id,
    });

    const history = await loadMensagens(conversa.id);
    const systemPrompt = buildIaSystemPrompt(iaConfig);
    const providerResult = await chatWithIaProvider(systemPrompt, history);

    let reply: string;
    if (!providerResult.ok) {
      reply =
        providerResult.reason === "missing_key" ? FALLBACK_UNAVAILABLE : FALLBACK_ERROR;
      await registrarEvento({
        tipo_evento: "ia_provider_erro",
        origem: ORIGEM,
        pagina,
        dados_evento: { reason: providerResult.reason },
      });
    } else {
      reply = providerResult.content;
    }

    await saveMensagem(conversa.id, "assistant", reply);

    let leadCreated = false;
    let leadId: string | null = conversa.lead_id as string | null;
    let whatsappOrigem = null;

    const { dados, prontoParaLead } = extrairLeadDaConversa(history);
    const extracaoPosAssistant = extrairLeadDaConversa([
      ...history,
      { role: "assistant", content: reply },
    ]);

    const dadosFinal = extracaoPosAssistant.prontoParaLead
      ? extracaoPosAssistant.dados
      : dados;
    const podeCriar =
      iaConfig.capturaLeadAtiva &&
      (extracaoPosAssistant.prontoParaLead || prontoParaLead) &&
      !leadId;

    if (podeCriar && dadosFinal.nome && dadosFinal.whatsapp) {
      const admin = createAdminClient();
      const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);

      const { data: leadRow, error: leadErr } = await admin
        .from("leads")
        .insert({
          nome: dadosFinal.nome.trim(),
          whatsapp: dadosFinal.whatsapp,
          cidade: dadosFinal.cidade ?? null,
          origem: ORIGEM,
          origem_detalhe: pagina,
          tipo_interesse: dadosFinal.tipoCredito ?? dadosFinal.tipoInteresse ?? "IA Chat",
          produto_interesse: dadosFinal.produtoInteresse ?? dadosFinal.tipoInteresse ?? null,
          tipo_credito: dadosFinal.tipoCredito ?? null,
          valor_credito: dadosFinal.valorAproximado ?? null,
          valor_simulado: dadosFinal.valorAproximado ?? null,
          entrada: dadosFinal.recursoProprio ?? null,
          observacao_indicacao: null,
          observacoes: dadosFinal.observacao?.slice(0, 500) ?? null,
          analise_ia: dadosFinal.resumo ?? null,
          dados_simulacao: {
            sessionId: body.sessionId,
            pagina_origem: pagina,
            url_origem: url,
            interesse: dadosFinal.tipoInteresse,
            tipoCredito: dadosFinal.tipoCredito,
            valorAproximado: dadosFinal.valorAproximado,
            urgencia: dadosFinal.urgencia,
            recursoProprio: dadosFinal.recursoProprio,
            mensagensResumo: history.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 500) })),
          },
          resultado_resumido: (dadosFinal.resumo ?? "").slice(0, 500),
          status: leadsConfig.statusInicialPadrao,
          criado_manual: false,
        })
        .select("id")
        .single();

      if (leadRow && !leadErr) {
        const newLeadId = leadRow.id as string;
        leadId = newLeadId;
        leadCreated = true;
        await updateConversaLead(conversa.id, newLeadId, dadosFinal);

        await registrarEvento({
          tipo_evento: "lead_criado",
          origem: ORIGEM,
          pagina,
          lead_id: leadId,
        });
        await registrarEvento({
          tipo_evento: "ia_lead_criado",
          origem: ORIGEM,
          pagina,
          lead_id: leadId,
          entidade_id: conversa.id,
        });

        const origemKey = iaConfig.whatsappOrigem?.trim() || ORIGEM;
        whatsappOrigem = await resolveWhatsappOrigem(origemKey);
        if (!whatsappOrigem) {
          whatsappOrigem = await resolveWhatsappOrigem(ORIGEM);
        }
        if (!whatsappOrigem && iaConfig.mostrarWhatsappPosLead) {
          const contato = await getConfigJsonPublic("contato", DEFAULT_CONTATO);
          const tel = contato.whatsappPrincipal?.trim();
          if (tel) {
            whatsappOrigem = {
              origem: ORIGEM,
              ativo: true,
              exibir_botao_apos_lead: true,
              nome_atendimento: null,
              whatsapp_destino: tel,
              mensagem_padrao: null,
              usar_whatsapp_principal_fallback: true,
            };
          }
        }
      }
    }

    if (leadCreated && iaConfig.regras.mensagemPosCadastro) {
      reply = `${reply}\n\n${iaConfig.regras.mensagemPosCadastro}`;
    }

    return NextResponse.json({
      reply,
      leadCreated,
      leadId,
      whatsappOrigem,
      providerUnavailable: !providerResult.ok,
      analiseResumo: dadosFinal.resumo,
      nomeLead: dadosFinal.nome,
      tipoInteresseLead: dadosFinal.tipoInteresse,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json(
      { reply: FALLBACK_ERROR, providerUnavailable: true, error: message },
      { status: 500 },
    );
  }
}
