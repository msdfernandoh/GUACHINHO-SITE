"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";
import { registrarEvento } from "@/lib/eventos/registrar";
import { queryLeadsForKanban, queryLeadsList } from "@/lib/crm/leads-query";
import type { LeadFilters } from "@/lib/crm/types";
import { buildLeadTimeline } from "@/lib/crm/timeline";
import { MOTIVOS_PERDA } from "@/lib/crm/constants";

async function touchInteracao(supabase: Awaited<ReturnType<typeof createClient>>, leadId: string) {
  await supabase
    .from("leads")
    .update({ ultima_interacao_at: new Date().toISOString() })
    .eq("id", leadId);
}

async function historico(
  leadId: string,
  usuarioId: string,
  acao: string,
  descricao: string,
  extra?: {
    status_anterior?: string;
    status_novo?: string;
    dados_anteriores?: Record<string, unknown>;
    dados_novos?: Record<string, unknown>;
  },
) {
  const supabase = await createClient();
  await supabase.from("leads_historico").insert({
    lead_id: leadId,
    usuario_id: usuarioId,
    acao,
    descricao,
    status_anterior: extra?.status_anterior ?? null,
    status_novo: extra?.status_novo ?? null,
    dados_anteriores: extra?.dados_anteriores ?? null,
    dados_novos: extra?.dados_novos ?? null,
  });
}

export async function createLeadManualAction(formData: FormData) {
  const usuario = await requireUsuario();
  const leadsConfig = await getConfigJson("leads", DEFAULT_LEADS);
  if (!leadsConfig.permitirCriarLeadManual && usuario.perfil !== "master") {
    throw new Error("Cadastro manual desabilitado");
  }

  const supabase = await createClient();
  const payload = {
    nome: String(formData.get("nome") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    cidade: String(formData.get("cidade") ?? "").trim() || null,
    origem: String(formData.get("origem") ?? "manual").trim(),
    origem_detalhe: String(formData.get("origem_detalhe") ?? "").trim() || null,
    tipo_interesse: String(formData.get("tipo_interesse") ?? "").trim() || null,
    produto_interesse: String(formData.get("produto_interesse") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    status: leadsConfig.statusInicialPadrao,
    criado_manual: true,
    criado_por_usuario_id: usuario.id,
    srd_responsavel_id: formData.get("srd_responsavel_id")
      ? String(formData.get("srd_responsavel_id"))
      : null,
    srd_responsavel_nome: String(formData.get("srd_responsavel_nome") ?? "").trim() || null,
  };

  const { data, error } = await supabase.from("leads").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  await historico(data.id, usuario.id, "lead_criado", "Lead criado manualmente no admin");
  revalidatePath("/admin/leads");
  redirect(`/admin/leads/${data.id}`);
}

export async function updateLeadAction(leadId: string, formData: FormData) {
  const usuario = await requireUsuario();
  const supabase = await createClient();

  const { data: before } = await supabase.from("leads").select("*").eq("id", leadId).single();

  const updates = {
    nome: String(formData.get("nome") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    cidade: String(formData.get("cidade") ?? "").trim() || null,
    origem: String(formData.get("origem") ?? "").trim() || null,
    tipo_interesse: String(formData.get("tipo_interesse") ?? "").trim() || null,
    produto_interesse: String(formData.get("produto_interesse") ?? "").trim() || null,
    status: String(formData.get("status") ?? before?.status ?? "Novo").trim(),
    temperatura: String(formData.get("temperatura") ?? "").trim() || null,
    valor_estimado: formData.get("valor_estimado")
      ? Number(formData.get("valor_estimado"))
      : before?.valor_estimado ?? null,
    proxima_acao: String(formData.get("proxima_acao") ?? "").trim() || null,
    data_proxima_acao: String(formData.get("data_proxima_acao") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    srd_responsavel_id: String(formData.get("srd_responsavel_id") ?? "").trim() || null,
    srd_responsavel_nome: String(formData.get("srd_responsavel_nome") ?? "").trim() || null,
  };

  const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (error) throw new Error(error.message);

  if (updates.srd_responsavel_id) {
    const { data: srdUser } = await supabase
      .from("usuarios")
      .select("nome")
      .eq("id", updates.srd_responsavel_id)
      .maybeSingle();
    if (srdUser?.nome) {
      await supabase
        .from("leads")
        .update({ srd_responsavel_nome: srdUser.nome })
        .eq("id", leadId);
      updates.srd_responsavel_nome = srdUser.nome;
    }
  } else if (!updates.srd_responsavel_id) {
    await supabase.from("leads").update({ srd_responsavel_nome: null }).eq("id", leadId);
  }

  await touchInteracao(supabase, leadId);
  if (before?.status !== updates.status) {
    await historico(leadId, usuario.id, "lead_status_alterado", `Status: ${updates.status}`, {
      status_anterior: before?.status,
      status_novo: updates.status,
    });
    await registrarEvento({
      tipo_evento: "lead_status_alterado",
      origem: "admin_crm",
      lead_id: leadId,
      usuario_id: usuario.id,
      dados_evento: { de: before?.status, para: updates.status },
    });
  }
  if (before?.temperatura !== updates.temperatura && updates.temperatura) {
    await historico(leadId, usuario.id, "lead_temperatura_alterada", `Temperatura: ${updates.temperatura}`);
  }
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
}

export async function agendarRetornoAction(leadId: string, formData: FormData) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const updates = {
    proximo_retorno_data: String(formData.get("proximo_retorno_data") ?? "").trim() || null,
    proximo_retorno_hora: String(formData.get("proximo_retorno_hora") ?? "").trim() || null,
    retorno_observacao: String(formData.get("retorno_observacao") ?? "").trim() || null,
  };
  const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (error) throw new Error(error.message);
  await historico(leadId, usuario.id, "retorno_agendado", "Retorno agendado/atualizado");
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function fecharLeadAction(leadId: string, formData: FormData) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const fechado = formData.get("fechado") === "true";
  const perdido = formData.get("perdido") === "true";
  const motivo = String(formData.get("motivo_perda") ?? "").trim();
  if (perdido && !motivo) throw new Error("Informe o motivo de perda");

  const now = new Date().toISOString();
  const updates = fechado
    ? {
        fechado: true,
        data_fechamento: String(formData.get("data_fechamento") ?? "").trim() || now.slice(0, 10),
        fechado_at: now,
        valor_fechado: Number(formData.get("valor_fechado") ?? 0),
        produto_fechado: String(formData.get("produto_fechado") ?? "").trim(),
        observacao_fechamento: String(formData.get("observacao_fechamento") ?? "").trim() || null,
        status: "Fechado",
        motivo_perda: null,
        observacao_perda: null,
        perdido_at: null,
      }
    : perdido
      ? {
          fechado: false,
          status: "Perdido",
          motivo_perda: motivo,
          observacao_perda: String(formData.get("observacao_perda") ?? "").trim() || null,
          perdido_at: now,
        }
      : { fechado: false };

  const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (error) throw new Error(error.message);
  await touchInteracao(supabase, leadId);
  await historico(
    leadId,
    usuario.id,
    fechado ? "lead_fechado" : perdido ? "lead_perdido" : "lead_reaberto",
    fechado ? "Lead fechado com sucesso" : perdido ? `Perdido: ${motivo}` : "Reabertura",
  );
  await registrarEvento({
    tipo_evento: fechado ? "lead_fechado" : perdido ? "lead_perdido" : "lead_reaberto",
    origem: "admin_crm",
    lead_id: leadId,
    usuario_id: usuario.id,
  });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
}

export async function deleteLeadAction(leadId: string) {
  const usuario = await requireUsuario();
  if (!canDeleteRecords(usuario.perfil)) {
    throw new Error("Sem permissão para excluir leads");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/leads");
  redirect("/admin/leads");
}

export async function fetchLeadsList(filters: LeadFilters) {
  return queryLeadsList(filters);
}

export async function fetchLeadsKanban() {
  return queryLeadsForKanban();
}

export async function updateLeadStatusAction(leadId: string, status: string) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const { data: before } = await supabase.from("leads").select("status").eq("id", leadId).single();
  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
  if (error) throw new Error(error.message);
  await touchInteracao(supabase, leadId);
  await historico(leadId, usuario.id, "lead_status_alterado", `Status → ${status}`, {
    status_anterior: before?.status,
    status_novo: status,
  });
  await registrarEvento({
    tipo_evento: "lead_status_alterado",
    origem: "admin_funil",
    lead_id: leadId,
    usuario_id: usuario.id,
    dados_evento: { de: before?.status, para: status },
  });
  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/funil");
}

export async function assignConsultorAction(leadId: string, srdId: string, srdNome: string) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ srd_responsavel_id: srdId || null, srd_responsavel_nome: srdNome || null })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
  await touchInteracao(supabase, leadId);
  await historico(leadId, usuario.id, "lead_consultor_atribuido", srdNome || "Removido");
  await registrarEvento({
    tipo_evento: "lead_consultor_atribuido",
    origem: "admin_crm",
    lead_id: leadId,
    usuario_id: usuario.id,
  });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
}

export async function createAtividadeAction(leadId: string, formData: FormData) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const row = {
    lead_id: leadId,
    usuario_id: usuario.id,
    tipo: String(formData.get("tipo") ?? "Tarefa"),
    titulo: String(formData.get("titulo") ?? "").trim() || null,
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    status: "pendente",
    data_agendada: String(formData.get("data_agendada") ?? "").trim() || null,
  };
  const { error } = await supabase.from("lead_atividades").insert(row);
  if (error) throw new Error(error.message);
  await touchInteracao(supabase, leadId);
  await historico(leadId, usuario.id, "lead_followup_criado", `${row.tipo}: ${row.titulo ?? ""}`);
  await registrarEvento({
    tipo_evento: "lead_followup_criado",
    origem: "admin_crm",
    lead_id: leadId,
    usuario_id: usuario.id,
  });
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function completeAtividadeAction(atividadeId: string, leadId: string) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("lead_atividades")
    .update({ status: "concluida", data_conclusao: now })
    .eq("id", atividadeId);
  if (error) throw new Error(error.message);
  await touchInteracao(supabase, leadId);
  await historico(leadId, usuario.id, "lead_followup_concluido", "Atividade concluída");
  await registrarEvento({
    tipo_evento: "lead_followup_concluido",
    origem: "admin_crm",
    lead_id: leadId,
    usuario_id: usuario.id,
  });
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function cancelAtividadeAction(atividadeId: string, leadId: string) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const { error } = await supabase.from("lead_atividades").update({ status: "cancelada" }).eq("id", atividadeId);
  if (error) throw new Error(error.message);
  await historico(leadId, usuario.id, "lead_followup_cancelado", "Atividade cancelada");
  revalidatePath(`/admin/leads/${leadId}`);
}


export async function fetchLeadDetail(leadId: string) {
  const supabase = await createClient();
  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (error) throw new Error(error.message);

  const { data: historicoRows } = await supabase
    .from("leads_historico")
    .select("*, usuarios(nome)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const { data: eventosRows } = await supabase
    .from("eventos_site")
    .select("id, created_at, tipo_evento, origem, dados_evento")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(80);

  const { data: atividades, error: atErr } = await supabase
    .from("lead_atividades")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const atividadesSafe = atErr ? [] : atividades ?? [];

  const timeline = buildLeadTimeline({
    historico: historicoRows ?? [],
    eventos: eventosRows ?? [],
    atividades: atividadesSafe,
    leadCreatedAt: lead.created_at,
    leadOrigem: lead.origem,
  });

  const { data: propostas } = await supabase
    .from("propostas")
    .select("id, created_at, status, tipo_proposta, valor_credito, pdf_url, lead_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  let iaConversa: Record<string, unknown> | null = null;
  let iaMensagens: Array<Record<string, unknown>> = [];
  if (lead.origem === "ia_chat") {
    const { data: conv } = await supabase
      .from("ia_conversas")
      .select("*")
      .eq("lead_id", leadId)
      .maybeSingle();
    iaConversa = conv ?? null;
    if (conv?.id) {
      const { data: msgs } = await supabase
        .from("ia_mensagens")
        .select("id, role, content, created_at")
        .eq("conversa_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(50);
      iaMensagens = msgs ?? [];
    }
  }

  return {
    lead,
    historico: historicoRows ?? [],
    propostas: propostas ?? [],
    iaConversa,
    iaMensagens,
    atividades: atividadesSafe,
    timeline,
  };
}

import { listarConsultores } from "@/lib/admin/consultores";

export async function fetchSrdOptions() {
  const supabase = await createClient();
  return listarConsultores(supabase);
}
