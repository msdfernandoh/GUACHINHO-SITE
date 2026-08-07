"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { filtrarRegistrosAreaParceiro, podeVerRegistroNoContexto } from "@/lib/parceiros/area-contexto";
import { requireAreaParceiroSession, requireAreaPerm } from "@/lib/parceiros/area-session";
import { FASE3_PERMISSOES } from "@/lib/parceiros/constants";
import {
  assertOrgNoContextoArea,
  propostaStatusEditavelParceiro,
  sanitizeLeadUpdateParceiro,
} from "@/lib/parceiros/rules";
import {
  generateAndStorePropostaPdf,
  getPropostaPdfDownloadUrl,
} from "@/lib/proposta/generate-pdf";

const LEAD_SELECT =
  "id, created_at, nome, whatsapp, email, status, observacoes, empresa_id, organizacao_parceira_id, participant_id, origem, criado_por_usuario_id";
const PROPOSTA_SELECT =
  "id, created_at, nome_cliente, whatsapp_cliente, email_cliente, tipo_proposta, valor_credito, prazo, entrada, valor_parcela, status, observacoes, pdf_url, lead_id, empresa_id, organizacao_parceira_id, participant_id";

function orgQuery(orgPreferida?: string | null) {
  return orgPreferida ? `?org=${encodeURIComponent(orgPreferida)}` : "";
}

export async function getAreaParceiroHome(orgPreferida?: string | null) {
  const session = await requireAreaParceiroSession({ orgPreferida });
  return {
    empresaNome: session.empresaNome,
    usuarioNome: session.usuarioNome,
    organizacaoIds: session.ctx.organizacaoIds,
    organizacaoAtivaId: session.organizacaoAtivaId,
    permissoes: session.permissoes,
    semOrgAtiva: session.ctx.organizacaoIds.length === 0,
  };
}

export async function listLeadsAreaParceiro(orgPreferida?: string | null) {
  const session = await requireAreaParceiroSession({ orgPreferida });
  await requireAreaPerm(session, FASE3_PERMISSOES.visualizarLeads);
  if (!session.organizacaoAtivaId) return { session, rows: [] as Record<string, unknown>[] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("empresa_id", session.empresaId)
    .eq("organizacao_parceira_id", session.organizacaoAtivaId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Não foi possível listar leads.");

  const rows = filtrarRegistrosAreaParceiro(session.ctx, data ?? []);
  return { session, rows };
}

export async function getLeadAreaParceiro(leadId: string, orgPreferida?: string | null) {
  const session = await requireAreaParceiroSession({ orgPreferida });
  await requireAreaPerm(session, FASE3_PERMISSOES.visualizarLeads);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("id", leadId)
    .maybeSingle();
  if (error || !data) throw new Error("Lead não encontrado.");
  if (!podeVerRegistroNoContexto(session.ctx, data)) {
    throw new Error("Lead não encontrado.");
  }

  const { data: historico } = await supabase
    .from("leads_historico")
    .select("id, created_at, acao, descricao, status_anterior, status_novo")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(30);

  return { session, lead: data, historico: historico ?? [] };
}

export async function createLeadAreaParceiroAction(formData: FormData) {
  const orgPreferida = String(formData.get("org") ?? "").trim() || null;
  const session = await requireAreaParceiroSession({ orgPreferida });
  await requireAreaPerm(session, FASE3_PERMISSOES.criarLeads);

  const orgId = session.organizacaoAtivaId;
  if (!orgId || !session.ctx.participantId) {
    throw new Error("Organização/participante ativo indisponível.");
  }
  const orgCheck = assertOrgNoContextoArea({
    orgId,
    orgsDoUsuario: session.ctx.organizacaoIds,
  });
  if (!orgCheck.ok) throw new Error(orgCheck.error);

  // Ignora qualquer empresa_id / org do payload do cliente.
  const payload = {
    nome: String(formData.get("nome") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    status: "Novo",
    origem: "area_parceiro",
    criado_manual: true,
    criado_por_usuario_id: session.usuarioId,
    empresa_id: session.empresaId,
    organizacao_parceira_id: orgId,
    participant_id: session.ctx.participantId,
    host_origem: String(formData.get("host_origem") ?? "").trim() || null,
    pagina_origem: String(formData.get("pagina_origem") ?? "").trim() || null,
    utm_source: String(formData.get("utm_source") ?? "").trim() || null,
    utm_medium: String(formData.get("utm_medium") ?? "").trim() || null,
    utm_campaign: String(formData.get("utm_campaign") ?? "").trim() || null,
  };
  if (!payload.nome) throw new Error("Nome é obrigatório.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").insert(payload).select("id").single();
  if (error || !data) throw new Error("Não foi possível criar o lead.");

  await supabase.from("leads_historico").insert({
    lead_id: data.id,
    usuario_id: session.usuarioId,
    acao: "lead_criado_area_parceiro",
    descricao: "Lead criado na área do parceiro",
  });

  revalidatePath("/area-parceiro/leads");
  redirect(`/area-parceiro/leads/${data.id}${orgQuery(orgId)}`);
}

export async function updateLeadAreaParceiroAction(formData: FormData) {
  const leadId = String(formData.get("id") ?? "").trim();
  const orgPreferida = String(formData.get("org") ?? "").trim() || null;
  if (!leadId) throw new Error("Lead inválido.");

  const session = await requireAreaParceiroSession({ orgPreferida });
  await requireAreaPerm(session, FASE3_PERMISSOES.editarLeads);

  const supabase = await createClient();
  const { data: before, error: beforeErr } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("id", leadId)
    .maybeSingle();
  if (beforeErr || !before) throw new Error("Lead não encontrado.");
  if (!podeVerRegistroNoContexto(session.ctx, before)) {
    throw new Error("Lead não encontrado.");
  }

  // Rejeita tentativa de alterar escopo via payload.
  if (formData.has("empresa_id") || formData.has("organizacao_parceira_id")) {
    throw new Error("Alteração de escopo não permitida.");
  }

  const sanitized = sanitizeLeadUpdateParceiro({
    nome: String(formData.get("nome") ?? before.nome),
    whatsapp: String(formData.get("whatsapp") ?? before.whatsapp ?? ""),
    email: String(formData.get("email") ?? before.email ?? ""),
    observacoes: String(formData.get("observacoes") ?? before.observacoes ?? ""),
    status: String(formData.get("status") ?? before.status ?? "Novo"),
  });
  if (!sanitized.ok) throw new Error(sanitized.error);

  const { error } = await supabase.from("leads").update(sanitized.data).eq("id", leadId);
  if (error) throw new Error("Não foi possível atualizar o lead.");

  if (before.status !== sanitized.data.status) {
    await supabase.from("leads_historico").insert({
      lead_id: leadId,
      usuario_id: session.usuarioId,
      acao: "lead_status_alterado",
      descricao: `Status: ${String(sanitized.data.status)}`,
      status_anterior: before.status,
      status_novo: String(sanitized.data.status),
    });
  } else {
    await supabase.from("leads_historico").insert({
      lead_id: leadId,
      usuario_id: session.usuarioId,
      acao: "lead_atualizado_area_parceiro",
      descricao: "Lead atualizado na área do parceiro",
    });
  }

  revalidatePath(`/area-parceiro/leads/${leadId}`);
  redirect(`/area-parceiro/leads/${leadId}${orgQuery(session.organizacaoAtivaId)}`);
}

export async function listPropostasAreaParceiro(orgPreferida?: string | null) {
  const session = await requireAreaParceiroSession({ orgPreferida });
  await requireAreaPerm(session, FASE3_PERMISSOES.visualizarPropostas);
  if (!session.organizacaoAtivaId) return { session, rows: [] as Record<string, unknown>[] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("propostas")
    .select(PROPOSTA_SELECT)
    .eq("empresa_id", session.empresaId)
    .eq("organizacao_parceira_id", session.organizacaoAtivaId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Não foi possível listar propostas.");

  const rows = filtrarRegistrosAreaParceiro(session.ctx, data ?? []);
  return { session, rows };
}

export async function getPropostaAreaParceiro(propostaId: string, orgPreferida?: string | null) {
  const session = await requireAreaParceiroSession({ orgPreferida });
  await requireAreaPerm(session, FASE3_PERMISSOES.visualizarPropostas);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("propostas")
    .select(PROPOSTA_SELECT)
    .eq("id", propostaId)
    .maybeSingle();
  if (error || !data) throw new Error("Proposta não encontrada.");
  if (!podeVerRegistroNoContexto(session.ctx, data)) {
    throw new Error("Proposta não encontrada.");
  }

  return {
    session,
    proposta: data,
    editavel: propostaStatusEditavelParceiro(data.status),
  };
}

export async function createPropostaAreaParceiroAction(formData: FormData) {
  const orgPreferida = String(formData.get("org") ?? "").trim() || null;
  const session = await requireAreaParceiroSession({ orgPreferida });
  await requireAreaPerm(session, FASE3_PERMISSOES.criarPropostas);

  const orgId = session.organizacaoAtivaId;
  if (!orgId || !session.ctx.participantId) {
    throw new Error("Organização/participante ativo indisponível.");
  }

  const leadId = String(formData.get("lead_id") ?? "").trim() || null;
  if (leadId) {
    const supabaseCheck = await createClient();
    const { data: lead } = await supabaseCheck
      .from("leads")
      .select("id, empresa_id, organizacao_parceira_id, participant_id")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead || !podeVerRegistroNoContexto(session.ctx, lead)) {
      throw new Error("Lead vinculado inválido.");
    }
  }

  const payload = {
    lead_id: leadId,
    nome_cliente: String(formData.get("nome_cliente") ?? "").trim(),
    whatsapp_cliente: String(formData.get("whatsapp_cliente") ?? "").trim() || null,
    email_cliente: String(formData.get("email_cliente") ?? "").trim() || null,
    tipo_proposta: String(formData.get("tipo_proposta") ?? "").trim() || null,
    valor_credito: Number(formData.get("valor_credito") ?? 0) || null,
    prazo: Number(formData.get("prazo") ?? 0) || null,
    entrada: Number(formData.get("entrada") ?? 0) || null,
    valor_parcela: Number(formData.get("valor_parcela") ?? 0) || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    status: "Gerada",
    empresa_id: session.empresaId,
    organizacao_parceira_id: orgId,
    participant_id: session.ctx.participantId,
  };
  if (!payload.nome_cliente) throw new Error("Nome do cliente é obrigatório.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("propostas").insert(payload).select("id").single();
  if (error || !data) throw new Error("Não foi possível criar a proposta.");

  revalidatePath("/area-parceiro/propostas");
  redirect(`/area-parceiro/propostas/${data.id}${orgQuery(orgId)}`);
}

export async function updatePropostaAreaParceiroAction(formData: FormData) {
  const propostaId = String(formData.get("id") ?? "").trim();
  const orgPreferida = String(formData.get("org") ?? "").trim() || null;
  if (!propostaId) throw new Error("Proposta inválida.");

  const session = await requireAreaParceiroSession({ orgPreferida });
  await requireAreaPerm(session, FASE3_PERMISSOES.editarPropostas);

  if (formData.has("empresa_id") || formData.has("organizacao_parceira_id")) {
    throw new Error("Alteração de escopo não permitida.");
  }

  const supabase = await createClient();
  const { data: before, error: beforeErr } = await supabase
    .from("propostas")
    .select(PROPOSTA_SELECT)
    .eq("id", propostaId)
    .maybeSingle();
  if (beforeErr || !before) throw new Error("Proposta não encontrada.");
  if (!podeVerRegistroNoContexto(session.ctx, before)) {
    throw new Error("Proposta não encontrada.");
  }
  if (!propostaStatusEditavelParceiro(before.status)) {
    throw new Error("Proposta fora de status editável (somente Gerada/PDF gerado).");
  }

  const nextStatus = String(formData.get("status") ?? before.status ?? "Gerada").trim();
  if (!propostaStatusEditavelParceiro(nextStatus)) {
    throw new Error("Status de proposta não permitido para edição do parceiro.");
  }

  const updates = {
    nome_cliente: String(formData.get("nome_cliente") ?? before.nome_cliente ?? "").trim(),
    whatsapp_cliente: String(formData.get("whatsapp_cliente") ?? before.whatsapp_cliente ?? "").trim() || null,
    email_cliente: String(formData.get("email_cliente") ?? before.email_cliente ?? "").trim() || null,
    tipo_proposta: String(formData.get("tipo_proposta") ?? before.tipo_proposta ?? "").trim() || null,
    valor_credito: Number(formData.get("valor_credito") ?? before.valor_credito ?? 0) || null,
    prazo: Number(formData.get("prazo") ?? before.prazo ?? 0) || null,
    entrada: Number(formData.get("entrada") ?? before.entrada ?? 0) || null,
    valor_parcela: Number(formData.get("valor_parcela") ?? before.valor_parcela ?? 0) || null,
    observacoes: String(formData.get("observacoes") ?? before.observacoes ?? "").trim() || null,
    status: nextStatus,
  };
  if (!updates.nome_cliente) throw new Error("Nome do cliente é obrigatório.");

  const { error } = await supabase.from("propostas").update(updates).eq("id", propostaId);
  if (error) throw new Error("Não foi possível atualizar a proposta.");

  revalidatePath(`/area-parceiro/propostas/${propostaId}`);
  redirect(`/area-parceiro/propostas/${propostaId}${orgQuery(session.organizacaoAtivaId)}`);
}

export async function gerarPdfPropostaAreaParceiroAction(formData: FormData) {
  const propostaId = String(formData.get("id") ?? "").trim();
  const orgPreferida = String(formData.get("org") ?? "").trim() || null;
  const session = await requireAreaParceiroSession({ orgPreferida });
  await requireAreaPerm(session, FASE3_PERMISSOES.editarPropostas);

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select(PROPOSTA_SELECT)
    .eq("id", propostaId)
    .maybeSingle();
  if (!proposta || !podeVerRegistroNoContexto(session.ctx, proposta)) {
    throw new Error("Proposta não encontrada.");
  }
  if (!propostaStatusEditavelParceiro(proposta.status)) {
    throw new Error("PDF só pode ser regenerado em proposta editável.");
  }

  await generateAndStorePropostaPdf(propostaId);
  revalidatePath(`/area-parceiro/propostas/${propostaId}`);
  redirect(`/area-parceiro/propostas/${propostaId}${orgQuery(session.organizacaoAtivaId)}`);
}

export async function getPdfUrlPropostaAreaParceiro(propostaId: string, orgPreferida?: string | null) {
  const session = await requireAreaParceiroSession({ orgPreferida });
  await requireAreaPerm(session, FASE3_PERMISSOES.visualizarPropostas);

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select(PROPOSTA_SELECT)
    .eq("id", propostaId)
    .maybeSingle();
  if (!proposta || !podeVerRegistroNoContexto(session.ctx, proposta)) {
    throw new Error("Proposta não encontrada.");
  }
  if (!proposta.pdf_url) return null;
  return getPropostaPdfDownloadUrl(propostaId);
}
