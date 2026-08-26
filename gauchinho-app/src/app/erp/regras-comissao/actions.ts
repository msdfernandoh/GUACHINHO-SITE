"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { commissionRuleScopesConflict, parseFranchiseRuleForm } from "@/lib/erp/commission-rule-input";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";

export type CommissionActionState = { ok: boolean; message: string; data?: any };

async function assertCanWrite(empresaId: string) {
  const { empresaAtiva } = await requireErpRouteAccess("regras-comissao");
  if (!empresaAtiva || empresaAtiva.id !== empresaId) {
    throw new Error("A empresa informada não corresponde ao tenant ativo.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_write_tenant_internal", {
    p_empresa_id: empresaId,
  });
  if (error || !data) {
    throw new Error("Somente o administrador da empresa ou Platform Superadmin pode alterar configurações de comissão.");
  }
  return supabase;
}

// --------------------------------------------------------------------------
// 1. PERFIS DE COMISSÃO (Entidade reutilizável por papel comercial)
// --------------------------------------------------------------------------

export async function createCommissionProfileAction(
  _previous: CommissionActionState,
  formData: FormData
): Promise<CommissionActionState> {
  try {
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const nome = String(formData.get("nome") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim() || null;
    const papelBase = String(formData.get("papel_base") ?? "CONSULTOR").trim().toUpperCase();

    if (!empresaId || !nome || !papelBase) {
      throw new Error("Empresa, nome do perfil e papel base são obrigatórios.");
    }

    const supabase = await assertCanWrite(empresaId);

    const { error } = await supabase.from("comissao_perfis").insert({
      empresa_id: empresaId,
      nome,
      descricao,
      papel_base: papelBase,
      ativo: true,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/erp/regras-comissao");
    return { ok: true, message: `Perfil "${nome}" criado com sucesso.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível criar o perfil.",
    };
  }
}

export async function updateCommissionProfileAction(
  _previous: CommissionActionState,
  formData: FormData
): Promise<CommissionActionState> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const nome = String(formData.get("nome") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim() || null;
    const papelBase = String(formData.get("papel_base") ?? "CONSULTOR").trim().toUpperCase();
    const ativo = formData.get("ativo") !== "false";

    if (!id || !empresaId || !nome) {
      throw new Error("ID, empresa e nome do perfil são obrigatórios.");
    }

    const supabase = await assertCanWrite(empresaId);

    const { error } = await supabase
      .from("comissao_perfis")
      .update({
        nome,
        descricao,
        papel_base: papelBase,
        ativo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw new Error(error.message);

    revalidatePath("/erp/regras-comissao");
    return { ok: true, message: "Perfil atualizado com sucesso." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível atualizar o perfil.",
    };
  }
}

export async function toggleCommissionProfileAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const ativo = formData.get("ativo") === "true";
  if (!id || !empresaId) return;

  const supabase = await assertCanWrite(empresaId);
  await supabase
    .from("comissao_perfis")
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", empresaId);

  revalidatePath("/erp/regras-comissao");
}

// --------------------------------------------------------------------------
// 2. REGRAS DOS PERFIS DE COMISSÃO (Draft, Edit, Homologate, Version)
// --------------------------------------------------------------------------

export async function saveParticipantProfileRuleAction(
  _previous: CommissionActionState,
  formData: FormData
): Promise<CommissionActionState> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const perfilId = String(formData.get("perfil_id") ?? "").trim();
    let programaId = String(formData.get("programa_id") ?? "").trim();
    const administradoraId = String(formData.get("administradora_id") ?? "").trim();
    const tipoAdministradoraId = String(formData.get("tipo_administradora_id") ?? "").trim() || null;
    const modalidadeComissaoId = String(formData.get("modalidade_comissao_id") ?? "").trim() || null;
    const baseV2 = String(formData.get("base_v2") ?? "COMISSAO_FRANQUEADORA_LIQUIDA").trim();
    const percentualComissao = Number(formData.get("percentual_comissao") ?? 0);
    const valorFixoTotal = formData.get("valor_fixo_total") ? Number(formData.get("valor_fixo_total")) : null;
    const seguirCronograma = formData.get("seguir_cronograma_franquia") !== "false";
    const aplicarCurva = formData.get("aplicar_curva_estorno") === "true";
    const curvaEstornoId = String(formData.get("curva_estorno_id") ?? "").trim() || null;
    const vigenciaInicio = String(formData.get("vigencia_inicio") ?? "").trim() || new Date().toISOString().slice(0, 10);
    const vigenciaFim = String(formData.get("vigencia_fim") ?? "").trim() || null;
    const nomeRegra = String(formData.get("nome_regra") ?? "").trim() || null;
    const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

    const supabase = await assertCanWrite(empresaId);

    if (!programaId && administradoraId) {
      const { data: prog } = await supabase
        .from("comissao_programas")
        .select("id")
        .eq("administradora_id", administradoraId)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prog) programaId = prog.id;
    }

    if (!programaId) {
      const { data: prog } = await supabase
        .from("comissao_programas")
        .select("id")
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prog) programaId = prog.id;
    }

    if (!empresaId || !perfilId || !programaId) {
      throw new Error("Empresa, Perfil e Administradora são obrigatórios.");
    }

    if (baseV2 !== "VALOR_FIXO" && (percentualComissao <= 0 || percentualComissao > 100)) {
      throw new Error("O percentual de comissão deve estar entre 0,01% e 100%.");
    }

    const payload: Record<string, unknown> = {
      empresa_id: empresaId,
      perfil_id: perfilId,
      programa_id: programaId,
      tipo_administradora_id: tipoAdministradoraId,
      modalidade_comissao_id: modalidadeComissaoId,
      base_v2: baseV2,
      base_calculo: baseV2 === "VALOR_FIXO" ? "valor_fixo" : "credito",
      percentual_comissao: baseV2 === "VALOR_FIXO" ? null : percentualComissao,
      valor_fixo_total: baseV2 === "VALOR_FIXO" ? valorFixoTotal : null,
      modo_regra: seguirCronograma ? "AUTOMATICA" : "MANUAL",
      seguir_cronograma_franquia: seguirCronograma,
      aplicar_curva_estorno: aplicarCurva,
      curva_estorno_id: aplicarCurva ? curvaEstornoId : null,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: vigenciaFim,
      nome_regra: nomeRegra,
      observacoes: observacoes,
      status: "RASCUNHO",
      configuracao_homologada: false,
      origem_configuracao: "ERP_MANUAL_NAO_HOMOLOGADO",
      ativa: true,
      etapas_cronograma: seguirCronograma
        ? []
        : [{ ordem: 1, mes_relativo: 1, percentual_etapa: 100, nome: "Parcela Única" }],
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { data: currentRule } = await supabase
        .from("comissao_regras_participantes")
        .select("status, configuracao_homologada")
        .eq("id", id)
        .eq("empresa_id", empresaId)
        .single();

      if (currentRule && currentRule.status === "HOMOLOGADA") {
        payload.status = "HOMOLOGADA";
        payload.configuracao_homologada = true;
        payload.origem_configuracao = "ERP";
      }

      const { error } = await supabase
        .from("comissao_regras_participantes")
        .update(payload)
        .eq("id", id)
        .eq("empresa_id", empresaId);
      if (error) throw new Error(error.message);
    } else {
      payload.versao = 1;
      const { error } = await supabase.from("comissao_regras_participantes").insert(payload);
      if (error) throw new Error(error.message);
    }

    revalidatePath("/erp/regras-comissao");
    return {
      ok: true,
      message: id ? "Regra atualizada em Rascunho." : "Regra criada em Rascunho. Clique em Homologar para ativá-la.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao salvar regra do perfil.",
    };
  }
}

export async function homologateParticipantProfileRuleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("regra_id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!id || !empresaId) throw new Error("ID e empresa são obrigatórios.");

  const supabase = await assertCanWrite(empresaId);

  const { data: regra, error } = await supabase
    .from("comissao_regras_participantes")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();

  if (error || !regra) throw new Error("Regra não encontrada.");

  if (!regra.programa_id) throw new Error("A regra precisa estar vinculada a um programa de Administradora.");
  if (regra.base_v2 !== "VALOR_FIXO" && (!regra.percentual_comissao || Number(regra.percentual_comissao) <= 0)) {
    throw new Error("Percentual de comissão inválido.");
  }

  const { error: updateErr } = await supabase
    .from("comissao_regras_participantes")
    .update({
      status: "HOMOLOGADA",
      configuracao_homologada: true,
      ativa: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (updateErr) throw new Error(updateErr.message);

  revalidatePath("/erp/regras-comissao");
}

export async function newVersionParticipantProfileRuleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("regra_id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!id || !empresaId) return;

  const supabase = await assertCanWrite(empresaId);

  const { data: current } = await supabase
    .from("comissao_regras_participantes")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();

  if (!current) return;

  await supabase
    .from("comissao_regras_participantes")
    .update({ status: "SUBSTITUIDA", updated_at: new Date().toISOString() })
    .eq("id", id);

  const { id: _oldId, created_at: _c, updated_at: _u, ...rest } = current;
  await supabase.from("comissao_regras_participantes").insert({
    ...rest,
    versao: (current.versao || 1) + 1,
    status: "RASCUNHO",
    configuracao_homologada: false,
    origem_configuracao: "ERP_MANUAL_NAO_HOMOLOGADO",
    ativa: true,
  });

  revalidatePath("/erp/regras-comissao");
}

export async function toggleParticipantProfileRuleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("regra_id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const ativa = formData.get("ativo") === "true";
  if (!id || !empresaId) return;

  const supabase = await assertCanWrite(empresaId);
  await supabase
    .from("comissao_regras_participantes")
    .update({
      ativa,
      status: ativa ? "HOMOLOGADA" : "INATIVA",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("empresa_id", empresaId);

  revalidatePath("/erp/regras-comissao");
}

export async function deleteParticipantProfileRuleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("regra_id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!id || !empresaId) return;

  const supabase = await assertCanWrite(empresaId);

  const { count } = await supabase
    .from("comissao_previsoes_participantes")
    .select("*", { count: "exact", head: true })
    .eq("regra_participante_id", id);

  if (count && count > 0) {
    throw new Error("Esta regra não pode ser excluída pois já possui vendas e previsões financeiras geradas.");
  }

  await supabase
    .from("comissao_regras_participantes")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);

  revalidatePath("/erp/regras-comissao");
}

// --------------------------------------------------------------------------
// 3. VÍNCULOS PARTICIPANTE -> FUNÇÃO -> PERFIL
// --------------------------------------------------------------------------

export async function linkParticipantePerfilAction(
  _previous: CommissionActionState,
  formData: FormData
): Promise<CommissionActionState> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const participanteId = String(formData.get("participante_id") ?? "").trim();
    const papelTipo = String(formData.get("papel_tipo") ?? "CONSULTOR").trim().toUpperCase();
    const perfilId = String(formData.get("perfil_id") ?? "").trim();
    const overridePercentual = formData.get("override_percentual")
      ? Number(formData.get("override_percentual"))
      : null;
    const vigenciaInicio = String(formData.get("vigencia_inicio") ?? "").trim() || new Date().toISOString().slice(0, 10);
    const vigenciaFim = String(formData.get("vigencia_fim") ?? "").trim() || null;
    const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

    if (!empresaId || !participanteId || !perfilId || !papelTipo) {
      throw new Error("Participante, Função Comercial e Perfil são obrigatórios.");
    }

    const supabase = await assertCanWrite(empresaId);

    const payload: Record<string, unknown> = {
      empresa_id: empresaId,
      participante_id: participanteId,
      papel_tipo: papelTipo,
      perfil_id: perfilId,
      override_percentual: overridePercentual,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: vigenciaFim,
      observacoes: observacoes,
      ativo: true,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await supabase
        .from("participante_comissao_perfis")
        .update(payload)
        .eq("id", id)
        .eq("empresa_id", empresaId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("participante_comissao_perfis")
        .insert(payload);
      if (error) throw new Error(error.message);
    }

    revalidatePath("/erp/regras-comissao");
    return { ok: true, message: "Vínculo de perfil do participante salvo com sucesso." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao vincular perfil ao participante.",
    };
  }
}

export async function unlinkParticipantePerfilAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!id || !empresaId) return;

  const supabase = await assertCanWrite(empresaId);
  await supabase
    .from("participante_comissao_perfis")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);

  revalidatePath("/erp/regras-comissao");
}

// --------------------------------------------------------------------------
// 4. CONFIGURAÇÃO FISCAL (Imposto sobre comissão da Franquia)
// --------------------------------------------------------------------------

export async function saveFiscalConfigAction(
  _previous: CommissionActionState,
  formData: FormData
): Promise<CommissionActionState> {
  try {
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const percentualImposto = Number(formData.get("percentual_imposto") ?? 0);
    const vigenciaInicio = String(formData.get("vigencia_inicio") ?? "").trim() || new Date().toISOString().slice(0, 10);
    const vigenciaFim = String(formData.get("vigencia_fim") ?? "").trim() || null;
    const exibeDetalhes = formData.get("participante_exibe_detalhes_fiscais") === "true";

    if (!empresaId) throw new Error("Empresa obrigatória.");
    if (percentualImposto < 0 || percentualImposto >= 100) {
      throw new Error("Percentual de imposto inválido.");
    }

    const supabase = await assertCanWrite(empresaId);

    const { error } = await supabase.from("empresa_configuracoes_fiscais").insert({
      empresa_id: empresaId,
      percentual_imposto: percentualImposto,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: vigenciaFim,
      participante_exibe_detalhes_fiscais: exibeDetalhes,
      ativo: true,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/erp/regras-comissao");
    return { ok: true, message: `Alíquota fiscal de ${percentualImposto}% salva com sucesso.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao salvar configuração fiscal.",
    };
  }
}

export const saveFiscalCommissionConfigAction = saveFiscalConfigAction;

// --------------------------------------------------------------------------
// 5. COMPATIBILIDADE COM MOTOR E COMPONENTES LEGADOS
// --------------------------------------------------------------------------

export async function createCommissionProgramAction(
  _previous: CommissionActionState,
  formData: FormData
): Promise<CommissionActionState> {
  try {
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const nome = String(formData.get("nome") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim() || null;
    const administradoraId = String(formData.get("administradora_id") ?? "").trim();
    if (!empresaId || !nome || !administradoraId) throw new Error("Empresa, nome e administradora são obrigatórios.");

    const supabase = await assertCanWrite(empresaId);
    const { error } = await supabase.from("comissao_programas").insert({
      empresa_id: empresaId,
      nome,
      descricao,
      administradora_id: administradoraId,
      ativo: true,
      versao: 1,
      status: "RASCUNHO",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/regras-comissao");
    return { ok: true, message: "Programa criado com sucesso." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível criar o programa." };
  }
}

export async function createFranchiseRuleAction(
  _previous: CommissionActionState,
  formData: FormData
): Promise<CommissionActionState> {
  try {
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    if (!empresaId) throw new Error("Empresa obrigatória.");
    const input = parseFranchiseRuleForm(formData);
    const supabase = await assertCanWrite(empresaId);

    const { data: createdRule, error } = await supabase
      .from("comissao_regras_franquia")
      .insert({
        empresa_id: empresaId,
        programa_id: input.programaId,
        versao: 1,
        base_calculo: input.baseCalculo,
        percentual_total_comissao: input.baseCalculo === "credito" ? input.valor : null,
        valor_fixo_total: input.baseCalculo === "valor_fixo" ? input.valor : null,
        vigencia_inicio: input.vigenciaInicio,
        vigencia_fim: input.vigenciaFim,
        modalidade: input.modalidade,
        opcao_cota_id: input.opcaoCotaId,
        plano_condicao: input.planoCondicao,
        tipo_administradora_id: input.tipoAdministradoraId,
        modalidade_comissao_id: input.modalidadeComissaoId,
        ativa: true,
        configuracao_homologada: false,
        origem_configuracao: "ERP_MANUAL_NAO_HOMOLOGADO",
        etapas_cronograma: input.etapas,
      })
      .select("id")
      .single();

    if (error || !createdRule) throw new Error(error?.message || "Erro ao criar regra.");

    revalidatePath("/erp/regras-comissao");
    return { ok: true, message: "Regra criada como rascunho." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível criar a regra." };
  }
}

export async function createParticipantRuleAction(
  _previous: CommissionActionState,
  formData: FormData
): Promise<CommissionActionState> {
  return saveParticipantProfileRuleAction(_previous, formData);
}

export async function homologateFranchiseRuleAction(formData: FormData): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const ruleId = String(formData.get("regra_id") ?? "").trim();
  if (!empresaId || !ruleId) throw new Error("Empresa e regra são obrigatórias.");
  const supabase = await assertCanWrite(empresaId);

  const { data: target, error: targetError } = await supabase
    .from("comissao_regras_franquia")
    .select("id,programa_id,vigencia_inicio,vigencia_fim,modalidade,opcao_cota_id,plano_condicao,tipo_administradora_id,modalidade_comissao_id")
    .eq("id", ruleId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (targetError || !target) throw new Error("Regra não encontrada.");

  const { data: homologated } = await supabase
    .from("comissao_regras_franquia")
    .select("id,programa_id,vigencia_inicio,vigencia_fim,modalidade,opcao_cota_id,plano_condicao,tipo_administradora_id,modalidade_comissao_id")
    .eq("empresa_id", empresaId)
    .eq("ativa", true)
    .eq("configuracao_homologada", true);

  const conflict = (homologated as any[] | null)?.find(
    (rule) =>
      rule.id !== target.id &&
      commissionRuleScopesConflict(
        {
          vigenciaInicio: rule.vigencia_inicio,
          vigenciaFim: rule.vigencia_fim,
          modalidade: rule.modalidade,
          opcaoCotaId: rule.opcao_cota_id,
          planoCondicao: rule.plano_condicao,
          tipoAdministradoraId: rule.tipo_administradora_id,
          modalidadeComissaoId: rule.modalidade_comissao_id,
        },
        {
          vigenciaInicio: target.vigencia_inicio,
          vigenciaFim: target.vigencia_fim,
          modalidade: target.modalidade,
          opcaoCotaId: target.opcao_cota_id,
          planoCondicao: target.plano_condicao,
          tipoAdministradoraId: target.tipo_administradora_id,
          modalidadeComissaoId: target.modalidade_comissao_id,
        }
      )
  );

  if (conflict) throw new Error("Homologação bloqueada: conflito de escopo com outra regra ativa.");

  await supabase
    .from("comissao_regras_franquia")
    .update({ configuracao_homologada: true, ativa: true })
    .eq("id", ruleId)
    .eq("empresa_id", empresaId);

  revalidatePath("/erp/regras-comissao");
}

export const homologateParticipantRuleAction = homologateParticipantProfileRuleAction;

export async function newCommissionProgramVersionAction(formData: FormData): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  const programaId = String(formData.get("programa_id") ?? "");
  const supabase = await assertCanWrite(empresaId);
  const { data: current } = await supabase.from("comissao_programas").select("*").eq("id", programaId).single();
  if (!current) return;
  const { id: _i, created_at: _c, updated_at: _u, ...rest } = current;
  await supabase.from("comissao_programas").insert({ ...rest, versao: current.versao + 1, status: "RASCUNHO", ativo: true });
  revalidatePath("/erp/regras-comissao");
}

export async function newCommissionRuleVersionAction(formData: FormData): Promise<void> {
  return newVersionParticipantProfileRuleAction(formData);
}

export async function toggleCommissionProgramAction(formData: FormData): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  const programaId = String(formData.get("programa_id") ?? "");
  const ativo = formData.get("ativo") === "true";
  const supabase = await assertCanWrite(empresaId);
  await supabase.from("comissao_programas").update({ ativo }).eq("id", programaId).eq("empresa_id", empresaId);
  revalidatePath("/erp/regras-comissao");
}

export async function toggleCommissionRuleAction(formData: FormData): Promise<void> {
  return toggleParticipantProfileRuleAction(formData);
}

export async function deleteCommissionProgramAction(formData: FormData): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  const programaId = String(formData.get("programa_id") ?? "");
  const supabase = await assertCanWrite(empresaId);
  await supabase.from("comissao_programas").delete().eq("id", programaId).eq("empresa_id", empresaId);
  revalidatePath("/erp/regras-comissao");
}

export async function deleteCommissionRuleAction(formData: FormData): Promise<void> {
  return deleteParticipantProfileRuleAction(formData);
}

export async function homologarRegraPadraoOficialAction(formData: FormData): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const administradoraId = String(formData.get("administradora_id") ?? "").trim();
  if (!empresaId) throw new Error("Empresa obrigatória.");
  const supabase = await assertCanWrite(empresaId);

  let { data: programa } = await supabase
    .from("comissao_programas")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("status", "ATIVO")
    .limit(1)
    .maybeSingle();

  if (!programa) {
    const { data: createdProg } = await supabase
      .from("comissao_programas")
      .insert({
        empresa_id: empresaId,
        nome: "Programa Padrão de Comissão (Oficial)",
        administradora_id: administradoraId || null,
        status: "ATIVO",
        ativo: true,
        versao: 1,
      })
      .select("id")
      .single();
    programa = createdProg;
  }

  if (programa?.id) {
    const { data: regra } = await supabase
      .from("comissao_regras_franquia")
      .insert({
        empresa_id: empresaId,
        programa_id: programa.id,
        versao: 1,
        base_calculo: "credito",
        percentual_total_comissao: 4.0,
        vigencia_inicio: "2020-01-01",
        configuracao_homologada: true,
        ativa: true,
        etapas_cronograma: [
          { ordem: 1, nome: "1ª Parcela", percentual_venda: 4.0, tipo_gatilho: "MES_RELATIVO", mes_relativo: 1 }
        ]
      })
      .select("id")
      .single();

    if (regra?.id) {
      await supabase.from("comissao_regra_etapas").insert({
        regra_franquia_id: regra.id,
        ordem: 1,
        nome: "1ª Parcela",
        percentual_venda: 4.0,
        tipo_gatilho: "MES_RELATIVO",
        mes_relativo: 1
      });
    }
  }

  revalidatePath("/erp/regras-comissao");
  revalidatePath("/erp/contratacoes");
}

export async function updateFranchiseRuleAction(
  _previous: CommissionActionState,
  formData: FormData
): Promise<CommissionActionState> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const percentual = Number(formData.get("percentual_total_comissao") ?? 0);
    const tipoAdministradoraId = String(formData.get("tipo_administradora_id") ?? "").trim() || null;
    const modalidadeComissaoId = String(formData.get("modalidade_comissao_id") ?? "").trim() || null;
    const vigenciaInicio = String(formData.get("vigencia_inicio") ?? "").trim() || "2020-01-01";
    const vigenciaFim = String(formData.get("vigencia_fim") ?? "").trim() || null;
    const ativa = formData.get("ativa") !== "false";

    if (!id || !empresaId) throw new Error("ID e empresa são obrigatórios.");

    const supabase = await assertCanWrite(empresaId);

    const { error } = await supabase
      .from("comissao_regras_franquia")
      .update({
        percentual_total_comissao: percentual > 0 ? percentual : null,
        tipo_administradora_id: tipoAdministradoraId,
        modalidade_comissao_id: modalidadeComissaoId,
        vigencia_inicio: vigenciaInicio,
        vigencia_fim: vigenciaFim,
        ativa: ativa,
        configuracao_homologada: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw new Error(error.message);

    revalidatePath("/erp/regras-comissao");
    return { ok: true, message: "Regra da Franqueadora atualizada com sucesso." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar regra." };
  }
}

export async function deleteFranchiseRuleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("regra_id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!id || !empresaId) return;

  const supabase = await assertCanWrite(empresaId);

  // Check if has predictions
  const { count } = await supabase
    .from("comissao_previsoes_franquia")
    .select("*", { count: "exact", head: true })
    .eq("regra_franquia_id", id);

  if (count && count > 0) {
    // If has forecasts, inactivate safely instead of hard delete
    await supabase
      .from("comissao_regras_franquia")
      .update({ ativa: false, configuracao_homologada: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
  } else {
    // Safe hard delete if duplicate or unused
    await supabase.from("comissao_regra_etapas").delete().eq("regra_franquia_id", id);
    await supabase
      .from("comissao_regras_franquia")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
  }

  revalidatePath("/erp/regras-comissao");
}

export async function cleanupDuplicateFranchiseRulesAction(formData: FormData): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!empresaId) return;

  const supabase = await assertCanWrite(empresaId);

  const { data: rules } = await supabase
    .from("comissao_regras_franquia")
    .select("id, tipo_administradora_id, modalidade_comissao_id, percentual_total_comissao, created_at")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: true });

  if (!rules || rules.length <= 1) return;

  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const r of rules) {
    const key = `${r.tipo_administradora_id || "null"}_${r.modalidade_comissao_id || "null"}_${r.percentual_total_comissao}`;
    if (seen.has(key)) {
      toDelete.push(r.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    await supabase.from("comissao_regra_etapas").delete().in("regra_franquia_id", toDelete);
    await supabase.from("comissao_regras_franquia").delete().in("id", toDelete);
  }

  revalidatePath("/erp/regras-comissao");
}

// --------------------------------------------------------------------------
// 6. CURVAS DE ESTORNO
// --------------------------------------------------------------------------

export async function saveCurvaEstornoAction(
  _previous: CommissionActionState,
  formData: FormData
): Promise<CommissionActionState> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const administradoraId = String(formData.get("administradora_id") ?? "").trim();
    const nome = String(formData.get("nome") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim() || null;
    const vigenciaInicio = String(formData.get("vigencia_inicio") ?? "").trim() || new Date().toISOString().slice(0, 10);
    const vigenciaFim = String(formData.get("vigencia_fim") ?? "").trim() || null;
    const encerraNaContemplacao = formData.get("encerra_na_contemplacao") !== "false";
    const faixasJson = String(formData.get("faixas_json") ?? "[]").trim();

    if (!empresaId || !nome || !administradoraId) {
      throw new Error("Empresa, nome da curva e administradora são obrigatórios.");
    }

    let faixas: Array<{ mes: number; percentual: number }> = [];
    try {
      faixas = JSON.parse(faixasJson);
    } catch {
      faixas = [];
    }

    const supabase = await assertCanWrite(empresaId);

    let curvaId = id;
    if (id) {
      const { error } = await supabase
        .from("administradora_curvas_estorno")
        .update({
          nome,
          descricao,
          administradora_id: administradoraId,
          vigencia_inicio: vigenciaInicio,
          vigencia_fim: vigenciaFim,
          encerra_na_contemplacao: encerraNaContemplacao,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabase
        .from("administradora_curvas_estorno")
        .insert({
          empresa_id: empresaId,
          administradora_id: administradoraId,
          nome,
          descricao,
          versao: 1,
          vigencia_inicio: vigenciaInicio,
          vigencia_fim: vigenciaFim,
          encerra_na_contemplacao: encerraNaContemplacao,
          ativa: true,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message || "Erro ao criar curva.");
      curvaId = created.id;
    }

    // Atualiza as faixas
    if (curvaId && faixas.length > 0) {
      await supabase.from("administradora_curva_estorno_faixas").delete().eq("curva_id", curvaId);
      const faixasPayload = faixas
        .filter((f) => f.mes > 0 && f.percentual >= 0)
        .map((f) => ({
          curva_id: curvaId,
          mes_relativo: f.mes,
          percentual_estorno: f.percentual,
        }));
      if (faixasPayload.length > 0) {
        await supabase.from("administradora_curva_estorno_faixas").insert(faixasPayload);
      }
    }

    revalidatePath("/erp/regras-comissao");
    return { ok: true, message: "Curva de estorno salva com sucesso." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao salvar curva de estorno." };
  }
}

export async function deleteCurvaEstornoAction(formData: FormData): Promise<void> {
  const id = String(formData.get("curva_id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!id || !empresaId) return;

  const supabase = await assertCanWrite(empresaId);

  await supabase.from("administradora_curva_estorno_faixas").delete().eq("curva_id", id);
  await supabase.from("administradora_curvas_estorno").delete().eq("id", id);

  revalidatePath("/erp/regras-comissao");
}

export async function toggleCurvaEstornoAction(formData: FormData): Promise<void> {
  const id = String(formData.get("curva_id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const ativa = formData.get("ativo") === "true";
  if (!id || !empresaId) return;

  const supabase = await assertCanWrite(empresaId);
  await supabase
    .from("administradora_curvas_estorno")
    .update({ ativa })
    .eq("id", id);

  revalidatePath("/erp/regras-comissao");
}
