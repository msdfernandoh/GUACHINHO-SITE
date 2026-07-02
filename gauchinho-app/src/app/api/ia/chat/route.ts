import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { DEFAULT_CONTATO, DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { DEFAULT_IA_CONFIG, type IaConfig } from "@/lib/config/ia-defaults";
import { buildIaSystemPrompt } from "@/lib/ia/system-prompt";
import { chatWithIaProvider } from "@/lib/ia/provider";
import { extrairLeadDaConversa } from "@/lib/ia/extrair-lead";
import {
  buildFallbackReply,
  FALLBACK_PROVIDER_ERROR,
  FALLBACK_WELCOME_NO_AI,
  isOpenAiConfigured,
  logIaDiagnostics,
} from "@/lib/ia/fallback-engine";
import {
  getOrCreateConversa,
  loadMensagens,
  saveMensagem,
  updateConversaLead,
} from "@/lib/ia/conversa-db";
import { resolveWhatsappOrigem } from "@/lib/whatsapp/resolve-origem";
import type { IaChatMessage } from "@/lib/ia/types";

const ORIGEM = "ia_chat";

type Body = {
  sessionId: string;
  message: string;
  paginaOrigem?: string;
  urlOrigem?: string;
  /** Histórico do cliente — usado se persistência falhar ou para contexto. */
  history?: IaChatMessage[];
};

type ChatResponse = {
  ok: boolean;
  mode: "ai" | "fallback";
  message: string;
  reply: string;
  showLeadCapture?: boolean;
  leadCreated?: boolean;
  leadId?: string | null;
  whatsappOrigem?: unknown;
  providerUnavailable?: boolean;
  nomeLead?: string;
  tipoInteresseLead?: string;
  analiseResumo?: string;
};

async function criarLeadFromConversa(
  dadosFinal: ReturnType<typeof extrairLeadDaConversa>["dados"],
  body: Body,
  pagina: string,
  url: string,
  sessionId: string,
  history: IaChatMessage[],
  conversaId: string | null,
  iaConfig: IaConfig,
) {
  const admin = createAdminClient();
  const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);

  const { data: leadRow, error: leadErr } = await admin
    .from("leads")
    .insert({
      nome: dadosFinal.nome!.trim(),
      whatsapp: dadosFinal.whatsapp!,
      cidade: dadosFinal.cidade ?? null,
      origem: ORIGEM,
      origem_detalhe: pagina,
      tipo_interesse: dadosFinal.tipoCredito ?? dadosFinal.tipoInteresse ?? "IA Chat",
      produto_interesse: dadosFinal.produtoInteresse ?? dadosFinal.tipoInteresse ?? null,
      tipo_credito: dadosFinal.tipoCredito ?? null,
      valor_credito: dadosFinal.valorAproximado ?? null,
      valor_simulado: dadosFinal.valorAproximado ?? null,
      entrada: dadosFinal.recursoProprio ?? null,
      observacoes: dadosFinal.observacao?.slice(0, 500) ?? null,
      analise_ia: dadosFinal.resumo ?? null,
      dados_simulacao: {
        sessionId,
        pagina_origem: pagina,
        url_origem: url,
        interesse: dadosFinal.tipoInteresse,
        tipoCredito: dadosFinal.tipoCredito,
        valorAproximado: dadosFinal.valorAproximado,
        modo: isOpenAiConfigured() ? "ai" : "fallback",
        mensagensResumo: history.slice(-8).map((m) => ({
          role: m.role,
          content: m.content.slice(0, 500),
        })),
      },
      resultado_resumido: (dadosFinal.resumo ?? "").slice(0, 500),
      status: leadsConfig.statusInicialPadrao,
      criado_manual: false,
    })
    .select("id")
    .single();

  if (leadErr || !leadRow) {
    console.error("[ia/chat] erro ao criar lead:", leadErr?.message);
    return null;
  }

  const leadId = leadRow.id as string;
  if (conversaId) {
    try {
      await updateConversaLead(conversaId, leadId, dadosFinal);
    } catch (e) {
      console.warn("[ia/chat] updateConversaLead falhou:", e);
    }
  }

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
    entidade_id: conversaId ?? undefined,
  });

  let whatsappOrigem = await resolveWhatsappOrigem(iaConfig.whatsappOrigem?.trim() || ORIGEM);
  if (!whatsappOrigem) whatsappOrigem = await resolveWhatsappOrigem(ORIGEM);
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

  return { leadId, whatsappOrigem };
}

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
    const sessionId = body.sessionId.trim();
    const userText = body.message.trim();

    let conversaId: string | null = null;
    let leadId: string | null = null;
    let history: IaChatMessage[] = Array.isArray(body.history) ? [...body.history] : [];

    try {
      const conversa = await getOrCreateConversa(sessionId, pagina, url);
      conversaId = conversa.id as string;
      leadId = (conversa.lead_id as string | null) ?? null;
      await saveMensagem(conversaId, "user", userText);
      history = await loadMensagens(conversaId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[ia/chat] persistência conversa:", msg);
      history = [...history, { role: "user", content: userText }];
    }

    await registrarEvento({
      tipo_evento: "ia_mensagem_enviada",
      origem: ORIGEM,
      pagina,
      entidade_id: conversaId ?? undefined,
    });

    const aiReady = isOpenAiConfigured();
    logIaDiagnostics(aiReady ? "provider ok" : "fallback (sem chave)");

    let mode: "ai" | "fallback" = "fallback";
    let reply: string;
    let showLeadCapture = false;
    let providerUnavailable = false;

    if (aiReady) {
      const systemPrompt = buildIaSystemPrompt(iaConfig);
      const providerResult = await chatWithIaProvider(systemPrompt, history);

      if (providerResult.ok) {
        mode = "ai";
        reply = providerResult.content;
      } else {
        providerUnavailable = true;
        await registrarEvento({
          tipo_evento: "ia_provider_erro",
          origem: ORIGEM,
          pagina,
          dados_evento: { reason: providerResult.reason },
        });
        console.error("[ia/chat] provider erro:", providerResult.reason, providerResult.message?.slice(0, 200));
        const fb = buildFallbackReply(history, iaConfig);
        reply = `${FALLBACK_PROVIDER_ERROR}\n\n${fb.reply}`;
        showLeadCapture = fb.showLeadCapture || providerResult.reason === "provider_error";
      }
    } else {
      providerUnavailable = true;
      const fb = buildFallbackReply(history, iaConfig);
      reply =
        history.filter((m) => m.role === "user").length <= 1
          ? `${FALLBACK_WELCOME_NO_AI}\n\n${fb.reply}`
          : fb.reply;
      showLeadCapture = fb.showLeadCapture;
    }

    if (conversaId) {
      try {
        await saveMensagem(conversaId, "assistant", reply);
      } catch (e) {
        console.warn("[ia/chat] save assistant:", e);
      }
    }

    let leadCreated = false;
    let whatsappOrigem = null;

    const extracaoPosAssistant = extrairLeadDaConversa([
      ...history,
      { role: "assistant", content: reply },
    ]);
    const dadosFinal = extracaoPosAssistant.dados;
    const podeCriar =
      iaConfig.capturaLeadAtiva &&
      extracaoPosAssistant.prontoParaLead &&
      !leadId &&
      dadosFinal.nome &&
      dadosFinal.whatsapp;

    if (podeCriar) {
      const created = await criarLeadFromConversa(
        dadosFinal,
        body,
        pagina,
        url,
        sessionId,
        history,
        conversaId,
        iaConfig,
      );
      if (created) {
        leadCreated = true;
        leadId = created.leadId;
        whatsappOrigem = created.whatsappOrigem;
        if (iaConfig.regras.mensagemPosCadastro) {
          reply = `${reply}\n\n${iaConfig.regras.mensagemPosCadastro}`;
        }
      }
    }

    const payload: ChatResponse = {
      ok: true,
      mode,
      message: reply,
      reply,
      showLeadCapture: showLeadCapture && !leadCreated,
      leadCreated,
      leadId,
      whatsappOrigem,
      providerUnavailable,
      nomeLead: dadosFinal.nome,
      tipoInteresseLead: dadosFinal.tipoInteresse,
      analiseResumo: dadosFinal.resumo,
    };

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    console.error("[ia/chat] fatal:", message);
    const payload: ChatResponse = {
      ok: false,
      mode: "fallback",
      message: FALLBACK_PROVIDER_ERROR,
      reply: FALLBACK_PROVIDER_ERROR,
      showLeadCapture: true,
      providerUnavailable: true,
    };
    return NextResponse.json(payload, { status: 200 });
  }
}
