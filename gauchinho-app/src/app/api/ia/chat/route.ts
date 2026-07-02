import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { DEFAULT_CONTATO, DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { DEFAULT_IA_CONFIG, resolveIaAssistantMode, type IaConfig } from "@/lib/config/ia-defaults";
import { buildIaSystemPrompt } from "@/lib/ia/system-prompt";
import { chatWithIaProvider } from "@/lib/ia/provider";
import { extrairLeadDaConversa } from "@/lib/ia/extrair-lead";
import {
  buildFallbackReply,
  isOpenAiConfigured,
  logIaDiagnostics,
} from "@/lib/ia/fallback-engine";
import {
  buildGuidedReply,
  stripGuidedMarker,
  type GuidedLeadPayload,
} from "@/lib/ia/guided-assistant";
import {
  getOrCreateConversa,
  loadMensagens,
  saveMensagem,
  updateConversaLead,
} from "@/lib/ia/conversa-db";
import { resolveWhatsappOrigem } from "@/lib/whatsapp/resolve-origem";
import type { IaChatMessage } from "@/lib/ia/types";

const ORIGEM = "ia_chat";
const ORIGEM_GUIDED = "ia_chat_guided";

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
  mode: "ai" | "fallback" | "guided" | "guided_fallback";
  message: string;
  reply: string;
  showLeadCapture?: boolean;
  showGuided?: boolean;
  leadCreated?: boolean;
  leadId?: string | null;
  whatsappOrigem?: unknown;
  providerUnavailable?: boolean;
  nomeLead?: string;
  tipoInteresseLead?: string;
  analiseResumo?: string;
};

async function criarLeadGuided(
  payload: GuidedLeadPayload,
  body: Body,
  pagina: string,
  url: string,
  sessionId: string,
  conversaId: string | null,
  iaConfig: IaConfig,
) {
  const admin = createAdminClient();
  const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);

  const { data: leadRow, error: leadErr } = await admin
    .from("leads")
    .insert({
      nome: payload.nome!.trim(),
      whatsapp: payload.whatsapp!,
      origem: ORIGEM_GUIDED,
      origem_detalhe: pagina,
      tipo_interesse: payload.intencao ?? "IA Chat guiado",
      tipo_credito: payload.tipoCredito ?? null,
      valor_credito: payload.valorCredito ?? null,
      valor_simulado: payload.valorCredito ?? null,
      observacoes: payload.observacao?.slice(0, 500) ?? null,
      dados_simulacao: {
        sessionId,
        pagina_origem: pagina,
        url_origem: url,
        ...payload.dadosSimulacao,
      },
      status: leadsConfig.statusInicialPadrao,
      criado_manual: false,
    })
    .select("id")
    .single();

  if (leadErr || !leadRow) {
    console.error("[ia/chat] erro lead guiado:", leadErr?.message);
    return null;
  }

  const leadId = leadRow.id as string;
  if (conversaId) {
    try {
      await updateConversaLead(conversaId, leadId, {
        nome: payload.nome,
        whatsapp: payload.whatsapp,
        tipoCredito: payload.tipoCredito,
        valorAproximado: payload.valorCredito,
        observacao: payload.observacao,
      });
    } catch (e) {
      console.warn("[ia/chat] updateConversaLead guiado:", e);
    }
  }

  await registrarEvento({
    tipo_evento: "lead_criado",
    origem: ORIGEM_GUIDED,
    pagina,
    lead_id: leadId,
  });
  await registrarEvento({
    tipo_evento: "ia_lead_criado",
    origem: ORIGEM_GUIDED,
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

    const assistantMode = resolveIaAssistantMode(iaConfig);

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
    logIaDiagnostics(aiReady ? "provider ok" : "sem chave openai");

    let mode: ChatResponse["mode"] = "guided";
    let replyRaw: string;
    let showLeadCapture = false;
    let providerUnavailable = false;
    let showGuided = false;
    let guidedLead: GuidedLeadPayload | undefined;

    const useGuidedOnly = assistantMode === "guided";
    const tryOpenAi = assistantMode === "openai" || assistantMode === "hybrid";

    if (useGuidedOnly) {
      const guided = buildGuidedReply(history, iaConfig);
      replyRaw = guided.reply;
      showLeadCapture = guided.showLeadCapture;
      if (guided.prontoParaLead && guided.leadPayload) guidedLead = guided.leadPayload;
      mode = "guided";
    } else if (tryOpenAi && aiReady) {
      const systemPrompt = buildIaSystemPrompt(iaConfig);
      const providerResult = await chatWithIaProvider(systemPrompt, history);

      if (providerResult.ok) {
        mode = "ai";
        replyRaw = providerResult.content;
      } else if (assistantMode === "hybrid") {
        providerUnavailable = true;
        await registrarEvento({
          tipo_evento: "ia_provider_erro",
          origem: ORIGEM,
          pagina,
          dados_evento: { reason: providerResult.reason, modo: "hybrid" },
        });
        const guided = buildGuidedReply(history, iaConfig);
        replyRaw = guided.reply;
        showLeadCapture = guided.showLeadCapture;
        if (guided.prontoParaLead && guided.leadPayload) guidedLead = guided.leadPayload;
        mode = "guided_fallback";
      } else {
        providerUnavailable = true;
        showGuided = true;
        const guided = buildGuidedReply(history, iaConfig);
        replyRaw = guided.reply;
        showLeadCapture = guided.showLeadCapture;
        if (guided.prontoParaLead && guided.leadPayload) guidedLead = guided.leadPayload;
        mode = "guided_fallback";
      }
    } else if (assistantMode === "openai" && !aiReady) {
      providerUnavailable = true;
      showGuided = true;
      const guided = buildGuidedReply(history, iaConfig);
      replyRaw = guided.reply;
      showLeadCapture = guided.showLeadCapture;
      if (guided.prontoParaLead && guided.leadPayload) guidedLead = guided.leadPayload;
      mode = "guided_fallback";
    } else {
      const guided = buildGuidedReply(history, iaConfig);
      replyRaw = guided.reply;
      showLeadCapture = guided.showLeadCapture;
      if (guided.prontoParaLead && guided.leadPayload) guidedLead = guided.leadPayload;
      mode = "guided_fallback";
    }

    const reply = stripGuidedMarker(replyRaw);

    if (conversaId) {
      try {
        await saveMensagem(conversaId, "assistant", replyRaw);
      } catch (e) {
        console.warn("[ia/chat] save assistant:", e);
      }
    }

    let leadCreated = false;
    let whatsappOrigem = null;

    if (
      iaConfig.capturaLeadAtiva &&
      guidedLead?.nome &&
      guidedLead.whatsapp &&
      !leadId
    ) {
      const created = await criarLeadGuided(
        guidedLead,
        body,
        pagina,
        url,
        sessionId,
        conversaId,
        iaConfig,
      );
      if (created) {
        leadCreated = true;
        leadId = created.leadId;
        whatsappOrigem = created.whatsappOrigem;
        if (iaConfig.regras.mensagemPosCadastro) {
          replyRaw = `${replyRaw}\n\n${iaConfig.regras.mensagemPosCadastro}`;
        }
      }
    }

    const extracaoPosAssistant = extrairLeadDaConversa([
      ...history,
      { role: "assistant", content: reply },
    ]);
    const dadosFinal = extracaoPosAssistant.dados;
    const podeCriar =
      iaConfig.capturaLeadAtiva &&
      extracaoPosAssistant.prontoParaLead &&
      !leadId &&
      !guidedLead &&
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
          replyRaw = `${replyRaw}\n\n${iaConfig.regras.mensagemPosCadastro}`;
        }
      }
    }

    const replyFinal = stripGuidedMarker(replyRaw);

    const payload: ChatResponse = {
      ok: true,
      mode,
      message: replyFinal,
      reply: replyFinal,
      showLeadCapture: showLeadCapture && !leadCreated,
      showGuided,
      leadCreated,
      leadId,
      whatsappOrigem,
      providerUnavailable,
      nomeLead: guidedLead?.nome ?? dadosFinal.nome,
      tipoInteresseLead: guidedLead?.intencao ?? dadosFinal.tipoInteresse,
      analiseResumo: dadosFinal.resumo,
    };

    if (assistantMode === "openai" && !aiReady && showGuided) {
      payload.ok = true;
      payload.message = replyFinal;
    }

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    console.error("[ia/chat] fatal:", message);
    const guided = buildGuidedReply([], DEFAULT_IA_CONFIG);
    const replyFinal = stripGuidedMarker(guided.reply);
    const payload: ChatResponse = {
      ok: true,
      mode: "guided_fallback",
      message: replyFinal,
      reply: replyFinal,
      showLeadCapture: guided.showLeadCapture,
      showGuided: true,
      providerUnavailable: true,
    };
    return NextResponse.json(payload, { status: 200 });
  }
}
