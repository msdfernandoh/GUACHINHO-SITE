"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";

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
    status: String(formData.get("status") ?? before?.status ?? "Novo").trim(),
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    srd_responsavel_id: String(formData.get("srd_responsavel_id") ?? "").trim() || null,
    srd_responsavel_nome: String(formData.get("srd_responsavel_nome") ?? "").trim() || null,
  };

  const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (error) throw new Error(error.message);

  await historico(leadId, usuario.id, "lead_atualizado", "Dados do lead atualizados", {
    status_anterior: before?.status,
    status_novo: updates.status,
  });
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

  const updates = fechado
    ? {
        fechado: true,
        data_fechamento: String(formData.get("data_fechamento") ?? "").trim(),
        valor_fechado: Number(formData.get("valor_fechado") ?? 0),
        produto_fechado: String(formData.get("produto_fechado") ?? "").trim(),
        status: "Fechado",
        motivo_perda: null,
      }
    : perdido
      ? {
          fechado: false,
          status: "Perdido",
          motivo_perda: String(formData.get("motivo_perda") ?? "").trim(),
        }
      : { fechado: false };

  const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (error) throw new Error(error.message);
  await historico(
    leadId,
    usuario.id,
    fechado ? "lead_fechado" : perdido ? "lead_perdido" : "lead_reaberto",
    fechado ? "Lead fechado com sucesso" : perdido ? "Lead marcado como perdido" : "Reabertura",
  );
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

export type LeadFilters = {
  periodo?: string;
  origem?: string;
  status?: string;
  srd?: string;
  retorno?: string;
  q?: string;
};

export async function fetchLeadsList(filters: LeadFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select(
      "id, created_at, nome, whatsapp, origem, status, tipo_interesse, srd_responsavel_nome, proximo_retorno_data, fechado",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.origem) query = query.eq("origem", filters.origem);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.srd) query = query.eq("srd_responsavel_id", filters.srd);
  if (filters.q) query = query.ilike("nome", `%${filters.q}%`);

  const today = new Date().toISOString().slice(0, 10);
  if (filters.retorno === "hoje") {
    query = query.eq("proximo_retorno_data", today);
  } else if (filters.retorno === "atrasados") {
    query = query.lt("proximo_retorno_data", today).not("proximo_retorno_data", "is", null);
  } else if (filters.retorno === "futuros") {
    query = query.gt("proximo_retorno_data", today);
  } else if (filters.retorno === "sem") {
    query = query.is("proximo_retorno_data", null);
  } else if (filters.retorno === "com") {
    query = query.not("proximo_retorno_data", "is", null);
  }

  if (filters.periodo === "7") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    query = query.gte("created_at", d.toISOString());
  } else if (filters.periodo === "30") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    query = query.gte("created_at", d.toISOString());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
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

  return { lead, historico: historicoRows ?? [], propostas: propostas ?? [], iaConversa, iaMensagens };
}

export async function fetchSrdOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuarios")
    .select("id, nome")
    .eq("perfil", "srd")
    .eq("ativo", true);
  return data ?? [];
}
