"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";
import { registrarEvento } from "@/lib/eventos/registrar";
import { queryLeadsForKanban, queryLeadsList } from "@/lib/crm/leads-query";
import {
  filterLeadsByScope,
  leadVisibleForScope,
  loadLeadAccessScope,
} from "@/lib/crm/lead-access";
import { enrichLeadsWithTipoSonho } from "@/lib/crm/lead-tipo-sonho";
import type { IndicacaoRapidaItem, LeadFilters } from "@/lib/crm/types";
import { buildLeadTimeline } from "@/lib/crm/timeline";
import { MOTIVOS_PERDA } from "@/lib/crm/constants";
import { isTipoSonhoSorteio, tipoSonhoParaCreditoLead } from "@/lib/eventos-sorteio/lead-map";
import { isDbMissingColumnError } from "@/lib/comercial-eventos/db-ready";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { upsertLeadPorTelefone, normalizePhoneForLead } from "@/lib/crm/upsert-lead";

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
  const intent = String(formData.get("intent") ?? "view").trim();
  const tipoSonhoRaw = String(formData.get("tipo_sonho") ?? "").trim();
  const eventoId = String(formData.get("evento_id") ?? "").trim() || null;
  let eventoNome = String(formData.get("evento_nome") ?? "").trim() || null;
  let produtoInteresse = String(formData.get("produto_interesse") ?? "").trim() || null;
  let tipoInteresse = String(formData.get("tipo_interesse") ?? "").trim() || null;

  if (eventoId) {
    const { data: ev } = await supabase.from("eventos").select("id, nome").eq("id", eventoId).maybeSingle();
    if (ev?.nome) eventoNome = String(ev.nome);
  }

  if (tipoSonhoRaw && isTipoSonhoSorteio(tipoSonhoRaw)) {
    const credito = tipoSonhoParaCreditoLead(tipoSonhoRaw);
    if (!tipoInteresse) tipoInteresse = credito;
    if (!produtoInteresse) produtoInteresse = credito;
  }

  // Evita gravar o nome do evento como produto.
  if (eventoNome && produtoInteresse && produtoInteresse.toLowerCase() === eventoNome.toLowerCase()) {
    produtoInteresse = tipoInteresse;
  }

  const origem = String(formData.get("origem") ?? "manual").trim() || "manual";
  const dadosSimulacao =
    tipoSonhoRaw || eventoId || eventoNome
      ? {
          origem: origem === "manual" ? "manual_admin" : origem,
          tipo_sonho: tipoSonhoRaw || null,
          evento_id: eventoId,
          evento_nome: eventoNome,
        }
      : null;

  const payload = {
    nome: String(formData.get("nome") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    cidade: String(formData.get("cidade") ?? "").trim() || null,
    origem,
    origem_detalhe: String(formData.get("origem_detalhe") ?? "").trim() || null,
    tipo_interesse: tipoInteresse,
    produto_interesse: produtoInteresse,
    evento_id: eventoId,
    evento_nome: eventoNome,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    status: leadsConfig.statusInicialPadrao,
    criado_manual: true,
    criado_por_usuario_id: usuario.id,
    srd_responsavel_id: formData.get("srd_responsavel_id")
      ? String(formData.get("srd_responsavel_id"))
      : null,
    srd_responsavel_nome: String(formData.get("srd_responsavel_nome") ?? "").trim() || null,
    ...(dadosSimulacao ? { dados_simulacao: dadosSimulacao } : {}),
  };

  let leadId: string;
  if (payload.whatsapp) {
    const upsertRes = await upsertLeadPorTelefone(supabase, payload as any);
    if (!upsertRes.ok || !upsertRes.lead_id) throw new Error("Não foi possível salvar o lead.");
    leadId = upsertRes.lead_id;
  } else {
    const { data, error } = await supabase.from("leads").insert(payload).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Falha ao criar lead");
    leadId = data.id;
  }

  await historico(leadId, usuario.id, "lead_criado", "Lead criado/atualizado no admin");
  revalidatePath("/admin/leads");
  if (intent === "stay") {
    redirect("/admin/leads/novo?ok=1");
  }
  redirect(`/admin/leads/${leadId}`);
}

/** Cria leads de indicação tendo o lead atual como quem indicou. */
export async function createIndicacoesFromLeadAction(
  indicadorLeadId: string,
  indicados: IndicacaoRapidaItem[],
): Promise<{ count: number; leadIds: string[] }> {
  const usuario = await requireUsuario();
  const leadsConfig = await getConfigJson("leads", DEFAULT_LEADS);
  const supabase = await createClient();
  const scope = await loadLeadAccessScope(
    usuario.id,
    usuario.perfil,
    usuario.leads_apenas_proprios,
  );

  const { data: indicador, error: indErr } = await supabase
    .from("leads")
    .select("id, nome, whatsapp, srd_responsavel_id, srd_responsavel_nome, evento_id")
    .eq("id", indicadorLeadId)
    .single();
  if (indErr || !indicador) throw new Error("Lead indicador não encontrado");
  if (!leadVisibleForScope(indicador, scope)) {
    throw new Error("Sem permissão para este lead");
  }

  const limpos = (indicados ?? [])
    .map((i) => ({
      nome: String(i.nome ?? "").trim(),
      whatsapp: String(i.whatsapp ?? "").trim(),
      tipoSonho: String(i.tipoSonho ?? "").trim() || null,
      parentesco: String(i.parentesco ?? "").trim() || null,
    }))
    .filter((i) => i.nome && i.whatsapp);
  if (limpos.length === 0) throw new Error("Inclua ao menos um indicado com nome e telefone");

  const leadIds: string[] = [];
  const indicadorNome = String(indicador.nome).trim();
  const indicadorTel = indicador.whatsapp ? String(indicador.whatsapp).trim() : null;

  for (const ind of limpos) {
    const tipoSonho = ind.tipoSonho && isTipoSonhoSorteio(ind.tipoSonho) ? ind.tipoSonho : null;
    const tipoCredito = tipoSonho ? tipoSonhoParaCreditoLead(tipoSonho) : null;
    const obsParts = [
      ind.parentesco ? `Parentesco: ${ind.parentesco}` : null,
      tipoSonho ? `Tipo: ${tipoSonho}` : null,
    ].filter(Boolean);
    const observacao = obsParts.length ? obsParts.join(" · ") : null;

    const payload: Record<string, unknown> = {
      nome: ind.nome,
      whatsapp: ind.whatsapp,
      email: null,
      origem: "indicacao",
      parceiro_indicador_nome: indicadorNome,
      parceiro_indicador_telefone: indicadorTel,
      parentesco_indicacao: ind.parentesco,
      indicador_lead_id: indicadorLeadId,
      tipo_interesse: tipoCredito ?? "outro",
      tipo_credito: tipoCredito,
      produto_interesse: tipoCredito,
      observacao_indicacao: observacao,
      observacoes: observacao,
      status: leadsConfig.statusInicialPadrao ?? "Novo",
      criado_manual: true,
      criado_por_usuario_id: usuario.id,
      srd_responsavel_id: indicador.srd_responsavel_id ?? null,
      srd_responsavel_nome: indicador.srd_responsavel_nome ?? null,
      dados_simulacao: {
        origem: "indicacao_admin",
        indicador_lead_id: indicadorLeadId,
        ...(tipoSonho ? { tipo_sonho: tipoSonho } : {}),
        ...(ind.parentesco ? { parentesco: ind.parentesco } : {}),
      },
    };

    const upsertRes = await upsertLeadPorTelefone(supabase, payload as any);

    if (!upsertRes.ok || !upsertRes.lead_id) {
      throw new Error(upsertRes.error ?? "Falha ao salvar indicação");
    }
    const leadRow = { id: upsertRes.lead_id };
    leadIds.push(leadRow.id);

    await historico(
      leadRow.id,
      usuario.id,
      "lead_criado",
      `Indicação rápida via admin — indicado por ${indicadorNome}`,
    );
    await registrarEvento({
      tipo_evento: "lead_criado",
      origem: "indicacao",
      pagina: "/admin/leads",
      lead_id: leadRow.id,
      dados_evento: {
        indicador: indicadorNome,
        indicadorLeadId,
        ...(ind.parentesco ? { parentesco: ind.parentesco } : {}),
        ...(tipoSonho ? { tipoSonho } : {}),
      },
    });
  }

  await touchInteracao(supabase, indicadorLeadId);
  await historico(
    indicadorLeadId,
    usuario.id,
    "indicacao_registrada",
    `${leadIds.length} indicação(ões) cadastrada(s) a partir deste lead`,
    { dados_novos: { leadIds } },
  );

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${indicadorLeadId}`);
  return { count: leadIds.length, leadIds };
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
    evento_id: String(formData.get("evento_id") ?? "").trim() || null,
    evento_nome: String(formData.get("evento_nome") ?? "").trim() || null,
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
    etapa_id: String(formData.get("etapa_id") ?? before?.etapa_id ?? "").trim() || null,
    fechado: before?.fechado ?? false,
    fechado_at: before?.fechado_at ?? null,
    data_fechamento: before?.data_fechamento ?? null,
    perdido_at: before?.perdido_at ?? null,
  };

  const etapaIdForm = String(formData.get("etapa_id") ?? "").trim();
  if (etapaIdForm) {
    const { data: etapaRow } = await supabase
      .from("crm_funil_etapas")
      .select("id, nome, is_won, is_lost")
      .eq("id", etapaIdForm)
      .maybeSingle();
    if (etapaRow) {
      updates.etapa_id = etapaRow.id;
      updates.status = etapaRow.nome;
      updates.fechado = etapaRow.is_won;
      if (etapaRow.is_won) {
        updates.fechado_at = new Date().toISOString();
        updates.data_fechamento = updates.data_fechamento || new Date().toISOString().slice(0, 10);
      } else {
        updates.fechado_at = null;
      }
      if (etapaRow.is_lost) {
        updates.perdido_at = new Date().toISOString();
      } else {
        updates.perdido_at = null;
      }
    }
  } else if (updates.status) {
    const { data: etapaByStatus } = await supabase
      .from("crm_funil_etapas")
      .select("id, nome, is_won, is_lost")
      .ilike("nome", updates.status)
      .maybeSingle();
    if (etapaByStatus) {
      updates.etapa_id = etapaByStatus.id;
      updates.fechado = etapaByStatus.is_won;
      if (etapaByStatus.is_won) {
        updates.fechado_at = new Date().toISOString();
        updates.data_fechamento = updates.data_fechamento || new Date().toISOString().slice(0, 10);
      }
    }
  }

  const eventoId = updates.evento_id;
  if (eventoId) {
    const { data: ev } = await supabase.from("eventos").select("nome").eq("id", eventoId).maybeSingle();
    if (ev?.nome) updates.evento_nome = String(ev.nome);
  }

  const tipoSonhoRaw = String(formData.get("tipo_sonho") ?? "").trim();
  if (tipoSonhoRaw) {
    const prevDados =
      before?.dados_simulacao && typeof before.dados_simulacao === "object"
        ? (before.dados_simulacao as Record<string, unknown>)
        : {};
    (updates as Record<string, unknown>).dados_simulacao = {
      ...prevDados,
      tipo_sonho: tipoSonhoRaw,
      evento_id: updates.evento_id,
      evento_nome: updates.evento_nome,
    };
  }

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
  // Limpa indicações associadas que poderiam ter RESTRICT
  await supabase.from("programa_indicacoes").delete().eq("lead_id", leadId);
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/crm");
  revalidatePath("/admin/crm/pipeline");
  revalidatePath("/admin");
  redirect("/admin/leads");
}

export async function bulkDeleteLeadsAction(
  leadIds: string[],
  confirmacao: string,
): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  try {
    const usuario = await requireUsuario();
    if (!canDeleteRecords(usuario.perfil)) {
      return { ok: false, error: "Sem permissão para excluir leads." };
    }
    if (confirmacao.trim().toUpperCase() !== "EXCLUIR") {
      return { ok: false, error: "Digite EXCLUIR para confirmar a exclusão em massa." };
    }
    const ids = [...new Set(leadIds.map((id) => id.trim()).filter(Boolean))];
    if (!ids.length) return { ok: false, error: "Nenhum lead selecionado." };

    const supabase = await createClient();

    // 1. Limpa vínculos dependentes em programa_indicacoes que possam travar por FK
    const { error: indErr } = await supabase
      .from("programa_indicacoes")
      .delete()
      .in("lead_id", ids);
    if (indErr) {
      console.warn("[bulkDeleteLeadsAction] Aviso ao desvincular programa_indicacoes:", indErr.message);
    }

    // 2. Executa exclusão dos leads
    const { error } = await supabase.from("leads").delete().in("id", ids);
    if (error) {
      console.error("[bulkDeleteLeadsAction] Erro no Supabase:", error);
      return { ok: false, error: `Erro ao excluir leads: ${error.message}` };
    }

    revalidatePath("/admin/leads");
    revalidatePath("/admin/crm");
    revalidatePath("/admin/crm/pipeline");
    revalidatePath("/admin");
    return { ok: true, deleted: ids.length };
  } catch (err) {
    console.error("[bulkDeleteLeadsAction] Falha inesperada:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro inesperado ao excluir leads.",
    };
  }
}

export async function bulkUpdateLeadEtapaAction(
  leadIds: string[],
  etapaIdOrSlug: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const usuario = await requireUsuario();
    const ids = [...new Set(leadIds.map((id) => id.trim()).filter(Boolean))];
    if (!ids.length) return { ok: false, error: "Nenhum lead selecionado." };
    if (!etapaIdOrSlug) return { ok: false, error: "Selecione a nova etapa." };

    const supabase = await createClient();
    const { empresaAtiva } = await getCurrentTenantContext();

    let etapaNome = etapaIdOrSlug;
    let isWon = false;
    let isLost = false;
    let realEtapaId: string | null = null;

    if (empresaAtiva) {
      const { data: etapa } = await supabase
        .from("crm_funil_etapas")
        .select("id, nome, slug, is_won, is_lost")
        .or(`id.eq.${etapaIdOrSlug},slug.eq.${etapaIdOrSlug}`)
        .eq("empresa_id", empresaAtiva.id)
        .maybeSingle();

      if (etapa) {
        etapaNome = etapa.nome;
        realEtapaId = etapa.id;
        isWon = etapa.is_won;
        isLost = etapa.is_lost;
      }
    }

    const updatePayload: Record<string, unknown> = {
      status: etapaNome,
      ultima_interacao_at: new Date().toISOString(),
      fechado: isWon,
    };

    if (realEtapaId) updatePayload.etapa_id = realEtapaId;
    if (isWon) {
      updatePayload.fechado_at = new Date().toISOString();
      updatePayload.data_fechamento = new Date().toISOString().slice(0, 10);
    } else {
      updatePayload.fechado_at = null;
    }
    if (isLost) {
      updatePayload.perdido_at = new Date().toISOString();
    } else {
      updatePayload.perdido_at = null;
    }

    const { error } = await supabase.from("leads").update(updatePayload).in("id", ids);
    if (error) {
      console.error("[bulkUpdateLeadEtapaAction] Erro:", error);
      return { ok: false, error: error.message };
    }

    for (const id of ids) {
      await historico(id, usuario.id, "lead_etapa_alterada", `Etapa alterada em lote para “${etapaNome}”`, {
        status_novo: etapaNome,
      });
    }

    revalidatePath("/admin/leads");
    revalidatePath("/admin/crm");
    revalidatePath("/admin/crm/pipeline");
    revalidatePath("/admin");
    return { ok: true, count: ids.length };
  } catch (err) {
    console.error("[bulkUpdateLeadEtapaAction] Exceção:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao atualizar etapas em lote.",
    };
  }
}

export async function fetchLeadsList(filters: LeadFilters) {
  const usuario = await requireUsuario();
  try {
    const rows = await queryLeadsList(filters);
    const scope = await loadLeadAccessScope(
      usuario.id,
      usuario.perfil,
      usuario.leads_apenas_proprios,
    );
    const filtered = filterLeadsByScope(rows, scope);
    return enrichLeadsWithTipoSonho(filtered);
  } catch (e) {
    console.error("[fetchLeadsList]", e instanceof Error ? e.message : e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function fetchLeadsKanban() {
  const usuario = await requireUsuario();
  const rows = await queryLeadsForKanban();
  const scope = await loadLeadAccessScope(
    usuario.id,
    usuario.perfil,
    usuario.leads_apenas_proprios,
  );
  return filterLeadsByScope(rows, scope);
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

export async function bulkAssignConsultorAction(leadIds: string[], srdId: string) {
  const usuario = await requireUsuario();
  if (!leadIds.length) throw new Error("Selecione ao menos um lead.");
  const supabase = await createClient();
  const { data: srdUser } = await supabase.from("usuarios").select("nome").eq("id", srdId).maybeSingle();
  const srdNome = srdUser?.nome ?? "";
  const { error } = await supabase
    .from("leads")
    .update({ srd_responsavel_id: srdId, srd_responsavel_nome: srdNome })
    .in("id", leadIds);
  if (error) throw new Error(error.message);
  for (const leadId of leadIds) {
    await touchInteracao(supabase, leadId);
    await historico(leadId, usuario.id, "lead_consultor_atribuido", srdNome || "Consultor atribuído em lote");
  }
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
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (error) throw new Error(error.message);

  const scope = await loadLeadAccessScope(
    usuario.id,
    usuario.perfil,
    usuario.leads_apenas_proprios,
  );
  if (
    !leadVisibleForScope(
      {
        srd_responsavel_id: (lead.srd_responsavel_id as string | null) ?? null,
        evento_id: (lead.evento_id as string | null) ?? null,
      },
      scope,
    )
  ) {
    throw new Error("Sem permissão para ver este lead");
  }

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

  const { data: contratacaoOnline } = await supabase
    .from("contratacoes_online")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  const { data: qualificacoesEventos, error: qualifErr } = await supabase
    .from("leads_eventos_qualificacoes")
    .select(
      "id, lead_id, evento_id, evento_nome, codigo_sorteio, qualificacao_respostas, lgpd_termo_versao, lgpd_consentimento_at, checkin_at, created_at"
    )
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const qualificacoesSafe = qualifErr ? [] : qualificacoesEventos ?? [];

  return {
    lead,
    historico: historicoRows ?? [],
    propostas: propostas ?? [],
    contratacaoOnline: contratacaoOnline ?? null,
    iaConversa,
    iaMensagens,
    atividades: atividadesSafe,
    timeline,
    qualificacoesEventos: qualificacoesSafe,
  };
}

import { listarConsultores } from "@/lib/admin/consultores";
import { fetchCrmFunilEtapas } from "@/lib/crm/leads-query";
import { randomUUID } from "node:crypto";
import type { CrmFunilEtapaRow, LeadArquivoRow } from "@/lib/crm/types";

export async function fetchSrdOptions() {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) return [];
  const supabase = await createClient();
  return listarConsultores(supabase, { empresaId: empresaAtiva.id });
}

export async function fetchCrmFunilEtapasAction(): Promise<CrmFunilEtapaRow[]> {
  const { empresaAtiva } = await getCurrentTenantContext();
  return fetchCrmFunilEtapas(empresaAtiva?.id);
}

export async function updateLeadEtapaAction(
  leadId: string,
  etapaIdOrSlug: string,
  extra?: {
    proximaAcao?: string;
    dataProximaAcao?: string;
    observacao?: string;
    motivoPerda?: string;
    temperatura?: string;
  },
) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const { empresaAtiva } = await getCurrentTenantContext();

  let etapaNome = etapaIdOrSlug;
  let isWon = false;
  let isLost = false;
  let realEtapaId: string | null = null;

  if (empresaAtiva) {
    const { data: etapa } = await supabase
      .from("crm_funil_etapas")
      .select("id, nome, slug, is_won, is_lost")
      .or(`id.eq.${etapaIdOrSlug},slug.eq.${etapaIdOrSlug}`)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle();

    if (etapa) {
      etapaNome = etapa.nome;
      realEtapaId = etapa.id;
      isWon = etapa.is_won;
      isLost = etapa.is_lost;
    }
  }

  const { data: before } = await supabase
    .from("leads")
    .select("status, etapa_id")
    .eq("id", leadId)
    .single();

  const updatePayload: Record<string, unknown> = {
    status: etapaNome,
    ultima_interacao_at: new Date().toISOString(),
    data_ultimo_contato: new Date().toISOString(),
  };

  if (realEtapaId) updatePayload.etapa_id = realEtapaId;
  if (extra?.proximaAcao) updatePayload.proxima_acao = extra.proximaAcao;
  if (extra?.dataProximaAcao) updatePayload.data_proxima_acao = extra.dataProximaAcao;
  if (extra?.temperatura) updatePayload.temperatura = extra.temperatura;

  if (extra?.motivoPerda) {
    updatePayload.motivo_perda_codigo = extra.motivoPerda;
    updatePayload.motivo_perda = extra.motivoPerda;
    updatePayload.observacao_perda = extra.observacao ?? extra.motivoPerda;
  }
  if (isWon) {
    updatePayload.fechado = true;
    updatePayload.fechado_at = new Date().toISOString();
    updatePayload.data_fechamento = new Date().toISOString().slice(0, 10);
  } else {
    updatePayload.fechado = false;
    updatePayload.fechado_at = null;
  }
  if (isLost) {
    updatePayload.perdido_at = new Date().toISOString();
  } else {
    updatePayload.perdido_at = null;
  }

  const { error } = await supabase.from("leads").update(updatePayload).eq("id", leadId);
  if (error) throw new Error(error.message);

  const descHistorico = extra?.observacao
    ? `Etapa alterada para “${etapaNome}”. Obs: ${extra.observacao}`
    : `Etapa alterada para “${etapaNome}”`;

  await historico(leadId, usuario.id, "lead_etapa_alterada", descHistorico, {
    status_anterior: before?.status,
    status_novo: etapaNome,
  });

  if (extra?.proximaAcao) {
    await supabase.from("lead_atividades").insert({
      lead_id: leadId,
      usuario_id: usuario.id,
      tipo: "Próximo passo",
      titulo: extra.proximaAcao,
      descricao: extra.observacao ?? null,
      status: "pendente",
      data_agendada: extra.dataProximaAcao ? new Date(extra.dataProximaAcao).toISOString() : null,
    });
  }

  await registrarEvento({
    tipo_evento: "lead_status_alterado",
    origem: "crm_pipeline",
    lead_id: leadId,
    usuario_id: usuario.id,
    dados_evento: { de: before?.status, para: etapaNome, etapa_id: realEtapaId },
  });

  revalidatePath("/admin/crm");
  revalidatePath("/admin/crm/pipeline");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/funil");
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function createLeadRapidoAction(data: {
  nome: string;
  contato: string;
  origem?: string;
  modeloInteresse?: string;
  produtoInteresse?: string;
  valorEstimado?: number;
  temperatura?: string;
  responsavelId?: string;
  proximaAcao?: string;
  observacoes?: string;
}) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa ativa não identificada.");

  if (!data.nome?.trim()) throw new Error("Nome ou identificação é obrigatório.");
  if (!data.contato?.trim()) throw new Error("Telefone, WhatsApp ou e-mail é obrigatório.");

  const isEmail = data.contato.includes("@");
  const whatsapp = !isEmail ? data.contato.trim() : null;
  const email = isEmail ? data.contato.trim().toLowerCase() : null;

  let etapaId: string | null = null;
  const { data: etapaNovo } = await supabase
    .from("crm_funil_etapas")
    .select("id")
    .eq("empresa_id", empresaAtiva.id)
    .eq("slug", "novo_lead")
    .maybeSingle();

  if (etapaNovo) etapaId = etapaNovo.id;

  const srdId = data.responsavelId || null;
  let srdNome: string | null = null;
  if (srdId) {
    const { data: resp } = await supabase.from("usuarios").select("nome").eq("id", srdId).maybeSingle();
    srdNome = resp?.nome ?? null;
  }

  if (whatsapp && normalizePhoneForLead(whatsapp).length >= 10) {
    const upsertRes = await upsertLeadPorTelefone(supabase, {
      empresa_id: empresaAtiva.id,
      nome: data.nome.trim(),
      whatsapp: whatsapp.trim(),
      email,
      origem: data.origem || "manual",
      status: "Novo",
      etapa_id: etapaId,
      tipo_interesse: data.produtoInteresse || null,
      produto_interesse: data.produtoInteresse || null,
      valor_estimado: data.valorEstimado ? Number(data.valorEstimado) : null,
      temperatura: data.temperatura || "Morno",
      modelo_interesse: data.modeloInteresse || "CLIENTE_FINAL",
      srd_responsavel_id: srdId,
      srd_responsavel_nome: srdNome,
      proxima_acao: data.proximaAcao || null,
      observacoes: data.observacoes || null,
    });

    if (!upsertRes.ok || !upsertRes.lead_id) {
      throw new Error(upsertRes.error || "Falha ao salvar lead");
    }

    const desc =
      upsertRes.action === "updated"
        ? "Lead reabordado / unificado via Entrada Rápida do CRM"
        : upsertRes.action === "copied_new_deal"
        ? "Nova negociação gerada via Entrada Rápida (Cliente com negócio anterior ganho)"
        : "Lead cadastrado via Entrada Rápida do CRM";

    await historico(upsertRes.lead_id, usuario.id, "lead_criado_rapido", desc);

    revalidatePath("/admin/crm");
    revalidatePath("/admin/crm/pipeline");
    revalidatePath("/admin/leads");
    return { id: upsertRes.lead_id, action: upsertRes.action };
  }

  // Fallback seguro caso o contato seja exclusivamente e-mail
  const isIncompleto = !email || !whatsapp || !data.produtoInteresse || !data.valorEstimado;

  const payload: Record<string, unknown> = {
    empresa_id: empresaAtiva.id,
    nome: data.nome.trim(),
    whatsapp: whatsapp || null,
    email,
    origem: data.origem || "manual",
    status: "Novo",
    etapa_id: etapaId,
    tipo_interesse: data.produtoInteresse || null,
    produto_interesse: data.produtoInteresse || null,
    valor_estimado: data.valorEstimado ? Number(data.valorEstimado) : null,
    temperatura: data.temperatura || "Morno",
    modelo_interesse: data.modeloInteresse || "CLIENTE_FINAL",
    srd_responsavel_id: srdId,
    srd_responsavel_nome: srdNome,
    proxima_acao: data.proximaAcao || null,
    observacoes: data.observacoes || null,
    is_incompleto: isIncompleto,
    criado_manual: true,
    criado_por_usuario_id: usuario.id,
    ultima_interacao_at: new Date().toISOString(),
    data_ultimo_contato: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabase.from("leads").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  await historico(inserted.id, usuario.id, "lead_criado_rapido", "Lead cadastrado via Entrada Rápida do CRM");

  revalidatePath("/admin/crm");
  revalidatePath("/admin/crm/pipeline");
  revalidatePath("/admin/leads");
  return { id: inserted.id, action: "created" as const };
}

export async function converterLeadParaErpAction(leadId: string): Promise<{ ok: boolean; redirectUrl: string }> {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa ativa não identificada.");

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, nome, whatsapp, telefone_normalizado, email, cidade, valor_estimado, valor_simulado, tipo_interesse, produto_interesse")
    .eq("id", leadId)
    .single();

  if (leadErr || !lead) throw new Error("Lead não encontrado.");

  // Verificar se já tem proposta
  const { data: propExistente } = await supabase
    .from("propostas")
    .select("id")
    .eq("lead_id", leadId)
    .limit(1)
    .maybeSingle();

  if (propExistente) {
    return { ok: true, redirectUrl: `/erp/propostas/${propExistente.id}` };
  }

  const token = randomUUID();
  const valorCredito = Number(lead.valor_estimado ?? lead.valor_simulado ?? 0);

  const { data: novaProp, error: propErr } = await supabase
    .from("propostas")
    .insert({
      empresa_id: empresaAtiva.id,
      lead_id: leadId,
      nome_cliente: lead.nome,
      telefone_cliente: lead.whatsapp || lead.telefone_normalizado || null,
      email_cliente: lead.email || null,
      cidade_cliente: lead.cidade || null,
      valor_credito: valorCredito > 0 ? valorCredito : null,
      tipo_interesse: lead.tipo_interesse || lead.produto_interesse || "imovel",
      status: "Gerada",
      token,
      criado_por_usuario_id: usuario.id,
    })
    .select("id")
    .single();

  if (propErr) throw new Error(propErr.message);

  await historico(
    leadId,
    usuario.id,
    "lead_enviado_erp",
    "Lead enviado para o ERP. Proposta gerada com sucesso.",
  );

  revalidatePath("/erp/propostas");
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true, redirectUrl: `/erp/propostas/${novaProp.id}` };
}

export async function fetchLeadArquivosAction(leadId: string): Promise<LeadArquivoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_arquivos")
    .select("id, empresa_id, lead_id, arquivo_url, arquivo_nome, arquivo_tamanho, mime_type, criado_por_usuario_id, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as LeadArquivoRow[];
}

export async function uploadLeadArquivoAction(leadId: string, formData: FormData) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa ativa não identificada.");

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new Error("Nenhum arquivo selecionado.");
  }

  const ext = file.name.split(".").pop() || "bin";
  const path = `${empresaAtiva.id}/leads/${leadId}/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("contratacoes-documentos")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

  const { error: insErr } = await supabase.from("lead_arquivos").insert({
    empresa_id: empresaAtiva.id,
    lead_id: leadId,
    arquivo_url: path,
    arquivo_nome: file.name,
    arquivo_tamanho: file.size,
    mime_type: file.type,
    criado_por_usuario_id: usuario.id,
  });

  if (insErr) throw new Error(insErr.message);

  await historico(leadId, usuario.id, "lead_arquivo_anexado", `Arquivo anexado: ${file.name}`);

  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true };
}

export async function getLeadArquivoSignedUrlAction(arquivoUrl: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("contratacoes-documentos")
    .createSignedUrl(arquivoUrl, 60 * 15);
  if (error || !data?.signedUrl) throw new Error("Falha ao gerar link do arquivo.");
  return data.signedUrl;
}

/**
 * Duplica um lead (especialmente no funil de ganho ou negociação fechada)
 * gerando uma NOVA NEGOCIAÇÃO no funil inicial ('novo_lead' / 'Novo'),
 * preservando o histórico consolidado e permitindo novo fluxo comercial.
 */
export async function duplicarLeadParaNovaNegociacaoAction(leadId: string): Promise<{ ok: boolean; newLeadId: string }> {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa ativa não identificada.");

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("empresa_id", empresaAtiva.id)
    .single();

  if (error || !lead) {
    throw new Error("Lead não encontrado para gerar nova negociação.");
  }

  // Busca etapa inicial 'novo_lead'
  const { data: etapaNovo } = await supabase
    .from("crm_funil_etapas")
    .select("id")
    .eq("empresa_id", empresaAtiva.id)
    .eq("slug", "novo_lead")
    .maybeSingle();

  const dataHora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const newEntry = `[${dataHora}] 🌟 NOVA NEGOCIAÇÃO GERADA (Cliente com histórico anterior #${lead.id.slice(0, 8)}):
• Operador: ${usuario.nome || "Equipe Comercial"}
• Origem: Duplicação / Nova oportunidade de negócio`;

  const histConsolidado = lead.historico_cadastros
    ? `${newEntry}\n\n---\n[Histórico Consolidado da Negociação Anterior]:\n${lead.historico_cadastros}`
    : lead.observacoes
    ? `${newEntry}\n\n---\n[Histórico Consolidado da Negociação Anterior]:\n${lead.observacoes}`
    : newEntry;

  const insertPayload = {
    empresa_id: empresaAtiva.id,
    nome: lead.nome,
    whatsapp: lead.whatsapp,
    telefone_normalizado: lead.telefone_normalizado,
    email: lead.email,
    cidade: lead.cidade,
    origem: "recorrente",
    origem_detalhe: `Nova negociação gerada a partir do lead #${lead.id.slice(0, 8)}`,
    tipo_interesse: lead.tipo_interesse,
    produto_interesse: lead.produto_interesse,
    tipo_credito: lead.tipo_credito,
    valor_estimado: lead.valor_estimado,
    status: "Novo",
    etapa_id: etapaNovo?.id || null,
    srd_responsavel_id: lead.srd_responsavel_id,
    srd_responsavel_nome: lead.srd_responsavel_nome,
    temperatura: "Quente",
    modelo_interesse: lead.modelo_interesse || "CLIENTE_FINAL",
    proxima_acao: "Fazer primeiro contato da nova negociação",
    historico_cadastros: histConsolidado,
    observacoes: histConsolidado,
    ultima_interacao_at: new Date().toISOString(),
    data_ultimo_contato: new Date().toISOString(),
    criado_manual: true,
    criado_por_usuario_id: usuario.id,
  };

  const { data: newLead, error: insertErr } = await supabase
    .from("leads")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertErr || !newLead) {
    throw new Error(`Falha ao gerar nova negociação: ${insertErr?.message}`);
  }

  await historico(
    newLead.id,
    usuario.id,
    "nova_negociacao_duplicada",
    `Nova negociação iniciada a partir do lead anterior #${lead.id.slice(0, 8)}`
  );

  await historico(
    lead.id,
    usuario.id,
    "nova_negociacao_gerada",
    `Cliente iniciou uma nova negociação (Lead #${newLead.id.slice(0, 8)})`
  );

  revalidatePath("/admin/crm");
  revalidatePath("/admin/crm/pipeline");
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${lead.id}`);

  return { ok: true, newLeadId: newLead.id };
}

