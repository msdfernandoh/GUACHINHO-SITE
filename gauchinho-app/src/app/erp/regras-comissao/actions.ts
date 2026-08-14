"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  commissionRuleScopesConflict,
  parseFranchiseRuleForm,
} from "@/lib/erp/commission-rule-input";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";

export type CommissionActionState = { ok: boolean; message: string };

async function assertCanWrite(empresaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_write_tenant_internal", {
    p_empresa_id: empresaId,
  });
  if (error || !data)
    throw new Error(
      "Somente o administrador da empresa ou o Platform Superadmin pode cadastrar regras.",
    );
  return supabase;
}

export async function createCommissionProgramAction(
  _previous: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  try {
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const nome = String(formData.get("nome") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim() || null;
    const administradoraId = String(
      formData.get("administradora_id") ?? "",
    ).trim();
    if (!empresaId || !nome || !administradoraId)
      throw new Error("Empresa, nome e administradora são obrigatórios.");

    const supabase = await assertCanWrite(empresaId);
    const { data: administradoraValida } = await supabase
      .from("empresa_administradoras")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("administradora_id", administradoraId)
      .eq("status", "ATIVA")
      .limit(1)
      .maybeSingle();
    if (!administradoraValida)
      throw new Error(
        "A Administradora precisa possuir concessão ativa para esta empresa.",
      );

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
    return {
      ok: true,
      message:
        "Programa criado. Agora cadastre quantas regras e versões forem necessárias.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível criar o programa.",
    };
  }
}

export async function createFranchiseRuleAction(
  _previous: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  try {
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    if (!empresaId) throw new Error("Empresa obrigatória.");
    const input = parseFranchiseRuleForm(formData);
    const supabase = await assertCanWrite(empresaId);

    const { data: programa, error: programaError } = await supabase
      .from("comissao_programas")
      .select("id,administradora_id")
      .eq("id", input.programaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (programaError || !programa)
      throw new Error("Programa não encontrado neste tenant.");
    if (!programa.administradora_id)
      throw new Error("O programa precisa ter uma administradora explícita.");

    if (input.opcaoCotaId) {
      const { data: cota } = await supabase
        .from("grupos_cotas")
        .select("id,grupo:grupos_consorcio!inner(administradora_id)")
        .eq("id", input.opcaoCotaId)
        .eq("grupo.administradora_id", programa.administradora_id)
        .maybeSingle();
      if (!cota)
        throw new Error(
          "A opção de cota não pertence à administradora do programa.",
        );
    }

    const { data: versions, error: versionError } = await supabase
      .from("comissao_regras_franquia")
      .select("versao")
      .eq("empresa_id", empresaId)
      .eq("programa_id", input.programaId)
      .order("versao", { ascending: false })
      .limit(1);
    if (versionError) throw new Error(versionError.message);
    const versao = Number(versions?.[0]?.versao ?? 0) + 1;

    const monthly = input.etapas.filter(
      (stage) => stage.tipo_gatilho === "MES_RELATIVO",
    );
    const monthlyTotal = monthly.reduce(
      (sum, stage) =>
        sum + Number(stage.percentual_venda ?? stage.valor_etapa ?? 0),
      0,
    );
    let accumulated = 0;
    const legacyStages = monthly.map((stage, index) => {
      const raw =
        input.baseCalculo === "credito"
          ? (Number(stage.percentual_venda ?? 0) / monthlyTotal) * 100
          : Number(stage.valor_etapa ?? 0);
      const value =
        index === monthly.length - 1 && input.baseCalculo === "credito"
          ? 100 - accumulated
          : Number(raw.toFixed(8));
      accumulated += value;
      return input.baseCalculo === "credito"
        ? {
            ordem: index + 1,
            nome: stage.nome,
            mes_relativo: stage.mes_relativo,
            percentual_etapa: value,
          }
        : {
            ordem: index + 1,
            nome: stage.nome,
            mes_relativo: stage.mes_relativo,
            valor_etapa: value,
          };
    });

    const { data: createdRule, error } = await supabase
      .from("comissao_regras_franquia")
      .insert({
        empresa_id: empresaId,
        programa_id: input.programaId,
        versao,
        base_calculo: input.baseCalculo,
        percentual_total_comissao:
          input.baseCalculo === "credito" ? input.valor : null,
        valor_fixo_total:
          input.baseCalculo === "valor_fixo" ? input.valor : null,
        vigencia_inicio: input.vigenciaInicio,
        vigencia_fim: input.vigenciaFim,
        modalidade: input.modalidade,
        opcao_cota_id: input.opcaoCotaId,
        plano_condicao: input.planoCondicao,
        etapas_cronograma: legacyStages,
        ativa: true,
        configuracao_homologada: false,
        origem_configuracao: "ERP_MANUAL_NAO_HOMOLOGADO",
        tipo_administradora_id: input.tipoAdministradoraId,
        modalidade_comissao_id: input.modalidadeComissaoId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (input.baseCalculo === "credito") {
      const { error: stagesError } = await supabase
        .from("comissao_regra_etapas")
        .insert(
          input.etapas.map((stage, index) => ({
            regra_franquia_id: createdRule.id,
            ordem: index + 1,
            tipo_gatilho: stage.tipo_gatilho,
            mes_relativo: stage.mes_relativo,
            nome: stage.nome,
            percentual_venda: stage.percentual_venda,
          })),
        );
      if (stagesError) {
        await supabase
          .from("comissao_regras_franquia")
          .delete()
          .eq("id", createdRule.id)
          .eq("configuracao_homologada", false);
        throw new Error(stagesError.message);
      }
    }
    revalidatePath("/erp/regras-comissao");
    return {
      ok: true,
      message: `Regra v${versao} criada como rascunho não homologado. Ela ainda não participa dos cálculos.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível criar a regra.",
    };
  }
}

type HomologationRule = {
  id: string;
  programa_id: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  modalidade: string | null;
  opcao_cota_id: string | null;
  plano_condicao: string | null;
  tipo_administradora_id: string | null;
  modalidade_comissao_id: string | null;
};

export async function homologateFranchiseRuleAction(
  formData: FormData,
): Promise<void> {
  if (!(await isPlatformSuperadmin()))
    throw new Error(
      "Somente o Platform Superadmin pode homologar uma regra financeira.",
    );
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const ruleId = String(formData.get("regra_id") ?? "").trim();
  if (!empresaId || !ruleId)
    throw new Error("Empresa e regra são obrigatórias.");
  const supabase = await assertCanWrite(empresaId);

  const { data: target, error: targetError } = await supabase
    .from("comissao_regras_franquia")
    .select(
      "id,programa_id,vigencia_inicio,vigencia_fim,modalidade,opcao_cota_id,plano_condicao,tipo_administradora_id,modalidade_comissao_id",
    )
    .eq("id", ruleId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (targetError || !target)
    throw new Error("Regra não encontrada neste tenant.");

  const { data: targetProgram } = await supabase
    .from("comissao_programas")
    .select("administradora_id,ativo")
    .eq("id", target.programa_id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!targetProgram?.administradora_id || !targetProgram.ativo)
    throw new Error(
      "O programa precisa estar ativo e possuir administradora explícita.",
    );

  const { data: sameAdminPrograms, error: programsError } = await supabase
    .from("comissao_programas")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("administradora_id", targetProgram.administradora_id)
    .eq("ativo", true);
  if (programsError) throw new Error(programsError.message);
  const programIds = (sameAdminPrograms ?? []).map(
    (program) => program.id as string,
  );
  const { data: homologated, error: rulesError } = await supabase
    .from("comissao_regras_franquia")
    .select(
      "id,programa_id,vigencia_inicio,vigencia_fim,modalidade,opcao_cota_id,plano_condicao,tipo_administradora_id,modalidade_comissao_id",
    )
    .eq("empresa_id", empresaId)
    .eq("ativa", true)
    .eq("configuracao_homologada", true)
    .in("programa_id", programIds);
  if (rulesError) throw new Error(rulesError.message);

  const candidate = target as HomologationRule;
  const conflict = (homologated as HomologationRule[] | null)?.find(
    (rule) =>
      rule.id !== candidate.id &&
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
          vigenciaInicio: candidate.vigencia_inicio,
          vigenciaFim: candidate.vigencia_fim,
          modalidade: candidate.modalidade,
          opcaoCotaId: candidate.opcao_cota_id,
          planoCondicao: candidate.plano_condicao,
          tipoAdministradoraId: candidate.tipo_administradora_id,
          modalidadeComissaoId: candidate.modalidade_comissao_id,
        },
      ),
  );
  if (conflict)
    throw new Error(
      "Homologação bloqueada: já existe regra homologada com a mesma precedência, escopo e vigência.",
    );

  const { error } = await supabase
    .from("comissao_regras_franquia")
    .update({ configuracao_homologada: true })
    .eq("id", ruleId)
    .eq("empresa_id", empresaId)
    .eq("ativa", true);
  if (error) throw new Error(error.message);
  revalidatePath("/erp/regras-comissao");
}

export async function createParticipantRuleAction(
  _previous: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  try {
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const programaId = String(formData.get("programa_id") ?? "").trim();
    const participanteId =
      String(formData.get("participante_comercial_id") ?? "").trim() || null;
    const modo = String(formData.get("modo_regra") ?? "MANUAL").toUpperCase();
    const baseV2 = String(
      formData.get("base_v2") ?? "COMISSAO_FRANQUEADORA_LIQUIDA",
    );
    const fonte = String(formData.get("fonte_comissao") ?? "FRANQUEADORA");
    const tipo = String(formData.get("tipo_participante") ?? "").trim() || null;
    const percentual = Number(
      String(formData.get("percentual_comissao") ?? "").replace(",", "."),
    );
    const vigenciaInicio = String(formData.get("vigencia_inicio") ?? "");
    const rawStages = String(formData.get("etapas_cronograma") ?? "");
    if (
      !empresaId ||
      !programaId ||
      !vigenciaInicio ||
      !Number.isFinite(percentual) ||
      percentual <= 0
    )
      throw new Error("Programa, percentual e vigência são obrigatórios.");
    if (!["AUTOMATICA", "MANUAL"].includes(modo))
      throw new Error("Modo de regra inválido.");
    let etapas: Array<{
      ordem: number;
      nome: string;
      mes_relativo: number;
      percentual_etapa: number;
    }>;
    if (modo === "AUTOMATICA") {
      etapas = [];
      if (
        baseV2 !== "COMISSAO_FRANQUEADORA_LIQUIDA" ||
        fonte !== "FRANQUEADORA"
      )
        throw new Error(
          "Regra automática deve usar a comissão líquida da Franqueadora como fonte.",
        );
    } else {
      try {
        etapas = JSON.parse(rawStages);
      } catch {
        throw new Error("Cronograma inválido.");
      }
      if (
        !Array.isArray(etapas) ||
        !etapas.length ||
        etapas.some(
          (e) =>
            !e.ordem || !e.nome || !e.mes_relativo || e.percentual_etapa <= 0,
        )
      )
        throw new Error("Informe etapas mensais válidas.");
      const soma = etapas.reduce(
        (total, etapa) => total + Number(etapa.percentual_etapa),
        0,
      );
      if (Math.abs(soma - 100) > 0.0001)
        throw new Error("O cronograma do participante deve somar 100%.");
    }
    if (!participanteId && !tipo)
      throw new Error(
        "Escolha um participante específico ou um papel para a regra geral.",
      );
    const supabase = await assertCanWrite(empresaId);
    const tipoAdministradoraId =
      String(formData.get("tipo_administradora_id") ?? "") || null;
    const modalidadeComissaoId =
      String(formData.get("modalidade_comissao_id") ?? "") || null;
    const { data: programa } = await supabase
      .from("comissao_programas")
      .select("administradora_id")
      .eq("id", programaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!programa?.administradora_id)
      throw new Error("Programa inválido para o tenant.");
    if (tipoAdministradoraId) {
      const { data: item } = await supabase
        .from("administradora_tipos")
        .select("id")
        .eq("id", tipoAdministradoraId)
        .eq("administradora_id", programa.administradora_id)
        .eq("ativo", true)
        .maybeSingle();
      if (!item)
        throw new Error("Tipo não pertence à Administradora do Programa.");
    }
    if (modalidadeComissaoId) {
      const { data: item } = await supabase
        .from("administradora_modalidades_comissao")
        .select("id")
        .eq("id", modalidadeComissaoId)
        .eq("administradora_id", programa.administradora_id)
        .eq("ativo", true)
        .maybeSingle();
      if (!item)
        throw new Error(
          "Modalidade não pertence à Administradora do Programa.",
        );
    }
    let conflictQuery = supabase
      .from("comissao_regras_participantes")
      .select("id,vigencia_inicio,vigencia_fim")
      .eq("empresa_id", empresaId)
      .eq("programa_id", programaId)
      .eq("ativa", true)
      .eq("modo_regra", modo)
      .eq("fonte_comissao", fonte);
    conflictQuery = participanteId
      ? conflictQuery.eq("participante_comercial_id", participanteId)
      : conflictQuery.is("participante_comercial_id", null);
    conflictQuery = tipo
      ? conflictQuery.eq("tipo_participante", tipo)
      : conflictQuery.is("tipo_participante", null);
    conflictQuery = tipoAdministradoraId
      ? conflictQuery.eq("tipo_administradora_id", tipoAdministradoraId)
      : conflictQuery.is("tipo_administradora_id", null);
    conflictQuery = modalidadeComissaoId
      ? conflictQuery.eq("modalidade_comissao_id", modalidadeComissaoId)
      : conflictQuery.is("modalidade_comissao_id", null);
    const { data: conflicts, error: conflictError } = await conflictQuery;
    if (conflictError) throw new Error(conflictError.message);
    const end = (v: string | null) => v ?? "9999-12-31";
    const vigenciaFim = String(formData.get("vigencia_fim") ?? "") || null;
    if (
      (conflicts ?? []).some(
        (r) =>
          vigenciaInicio <= end(r.vigencia_fim) &&
          r.vigencia_inicio <= end(vigenciaFim),
      )
    )
      throw new Error(
        "Já existe regra com o mesmo participante/papel, escopo e vigência.",
      );
    const { data: latest } = await supabase
      .from("comissao_regras_participantes")
      .select("versao")
      .eq("empresa_id", empresaId)
      .eq("programa_id", programaId)
      .order("versao", { ascending: false })
      .limit(1);
    const { error } = await supabase
      .from("comissao_regras_participantes")
      .insert({
        empresa_id: empresaId,
        programa_id: programaId,
        participante_comercial_id: participanteId,
        tipo_participante: tipo,
        percentual_comissao: percentual,
        base_calculo: "credito",
        versao: Number(latest?.[0]?.versao ?? 0) + 1,
        vigencia_inicio: vigenciaInicio,
        vigencia_fim: String(formData.get("vigencia_fim") ?? "") || null,
        etapas_cronograma: etapas,
        ativa: true,
        configuracao_homologada: false,
        origem_configuracao: "ERP_PARTICIPANTE_V2_NAO_HOMOLOGADO",
        modo_regra: modo,
        base_v2: baseV2,
        fonte_comissao: fonte,
        tipo_administradora_id: tipoAdministradoraId,
        modalidade_comissao_id: modalidadeComissaoId,
      });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/regras-comissao");
    return {
      ok: true,
      message:
        modo === "AUTOMATICA"
          ? "Regra automática salva. O cronograma será herdado da Franqueadora."
          : "Regra manual salva com cronograma próprio.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a regra do participante.",
    };
  }
}

export async function homologateParticipantRuleAction(
  formData: FormData,
): Promise<void> {
  if (!(await isPlatformSuperadmin()))
    throw new Error(
      "Somente o Platform Superadmin pode homologar uma regra financeira.",
    );
  const empresaId = String(formData.get("empresa_id") ?? "");
  const regraId = String(formData.get("regra_id") ?? "");
  const supabase = await assertCanWrite(empresaId);
  const { data: target, error: targetError } = await supabase
    .from("comissao_regras_participantes")
    .select(
      "id,programa_id,participante_comercial_id,tipo_participante,tipo_administradora_id,modalidade_comissao_id,fonte_comissao,vigencia_inicio,vigencia_fim",
    )
    .eq("id", regraId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (targetError || !target)
    throw new Error("Regra de participante não encontrada.");
  const { data: active, error: activeError } = await supabase
    .from("comissao_regras_participantes")
    .select(
      "id,programa_id,participante_comercial_id,tipo_participante,tipo_administradora_id,modalidade_comissao_id,fonte_comissao,vigencia_inicio,vigencia_fim",
    )
    .eq("empresa_id", empresaId)
    .eq("programa_id", target.programa_id)
    .eq("ativa", true)
    .eq("configuracao_homologada", true);
  if (activeError) throw new Error(activeError.message);
  const end = (value: string | null) => value ?? "9999-12-31";
  const ambiguous = (active ?? []).some(
    (rule) =>
      rule.id !== target.id &&
      rule.participante_comercial_id === target.participante_comercial_id &&
      rule.tipo_participante === target.tipo_participante &&
      rule.tipo_administradora_id === target.tipo_administradora_id &&
      rule.modalidade_comissao_id === target.modalidade_comissao_id &&
      rule.fonte_comissao === target.fonte_comissao &&
      target.vigencia_inicio <= end(rule.vigencia_fim) &&
      rule.vigencia_inicio <= end(target.vigencia_fim),
  );
  if (ambiguous)
    throw new Error(
      "Homologação bloqueada: regra de participante ambígua no mesmo contexto e vigência.",
    );
  const { error } = await supabase
    .from("comissao_regras_participantes")
    .update({ configuracao_homologada: true })
    .eq("id", regraId)
    .eq("empresa_id", empresaId)
    .eq("ativa", true);
  if (error) throw new Error(error.message);
  revalidatePath("/erp/regras-comissao");
}

export async function toggleCommissionProgramAction(
  formData: FormData,
): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  const programaId = String(formData.get("programa_id") ?? "");
  const ativo = formData.get("ativo") === "true";
  const supabase = await assertCanWrite(empresaId);
  const { error } = await supabase
    .from("comissao_programas")
    .update({ ativo, status: ativo ? "ATIVO" : "INATIVO" })
    .eq("id", programaId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);
  revalidatePath("/erp/regras-comissao");
}

export async function newCommissionProgramVersionAction(
  formData: FormData,
): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  const programaId = String(formData.get("programa_id") ?? "");
  const supabase = await assertCanWrite(empresaId);
  const { data: programa, error } = await supabase
    .from("comissao_programas")
    .select("nome,descricao,administradora_id,versao")
    .eq("id", programaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error || !programa) throw new Error("Programa não encontrado.");
  const { error: insertError } = await supabase
    .from("comissao_programas")
    .insert({
      empresa_id: empresaId,
      nome: programa.nome,
      descricao: programa.descricao,
      administradora_id: programa.administradora_id,
      versao: Number(programa.versao ?? 1) + 1,
      status: "RASCUNHO",
      ativo: true,
      programa_origem_id: programaId,
    });
  if (insertError) throw new Error(insertError.message);
  revalidatePath("/erp/regras-comissao");
}

export async function saveFiscalCommissionConfigAction(
  _previous: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  try {
    const empresaId = String(formData.get("empresa_id") ?? "");
    const percentual = Number(
      String(formData.get("percentual_imposto") ?? "").replace(",", "."),
    );
    const inicio = String(formData.get("vigencia_inicio") ?? "");
    const fim = String(formData.get("vigencia_fim") ?? "") || null;
    if (
      !empresaId ||
      !inicio ||
      !Number.isFinite(percentual) ||
      percentual < 0 ||
      percentual >= 100
    )
      throw new Error("Configuração fiscal inválida.");
    const supabase = await assertCanWrite(empresaId);
    const { error } = await supabase.rpc("rpc_salvar_configuracao_fiscal", {
      p_empresa_id: empresaId,
      p_percentual: percentual,
      p_vigencia_inicio: inicio,
      p_vigencia_fim: fim,
      p_exibe_detalhes:
        formData.get("participante_exibe_detalhes_fiscais") === "on",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/regras-comissao");
    return {
      ok: true,
      message:
        "Configuração fiscal salva e vigente conforme as datas informadas.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a configuração fiscal.",
    };
  }
}

export async function deleteCommissionProgramAction(
  formData: FormData,
): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  const id = String(formData.get("programa_id") ?? "");
  const db = await assertCanWrite(empresaId);
  const [{ count: rules }, { count: franchise }, { count: participants }] =
    await Promise.all([
      db
        .from("comissao_regras_franquia")
        .select("id", { count: "exact", head: true })
        .eq("programa_id", id),
      db
        .from("comissao_previsoes_franquia")
        .select("id,regra:comissao_regras_franquia!inner(programa_id)", {
          count: "exact",
          head: true,
        })
        .eq("regra.programa_id", id),
      db
        .from("comissao_previsoes_participantes")
        .select("id,regra:comissao_regras_participantes!inner(programa_id)", {
          count: "exact",
          head: true,
        })
        .eq("regra.programa_id", id),
    ]);
  if ((rules ?? 0) > 0 || (franchise ?? 0) > 0 || (participants ?? 0) > 0)
    throw new Error(
      "Programa possui regras ou uso histórico. Inative em vez de excluir.",
    );
  const { error } = await db
    .from("comissao_programas")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);
  revalidatePath("/erp/regras-comissao");
}

export async function deleteCommissionRuleAction(
  formData: FormData,
): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  const id = String(formData.get("regra_id") ?? "");
  const kind = String(formData.get("tipo_regra") ?? "");
  const db = await assertCanWrite(empresaId);
  if (kind === "PARTICIPANTE") {
    const { data: rule } = await db
      .from("comissao_regras_participantes")
      .select("configuracao_homologada")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!rule) throw new Error("Regra não encontrada.");
    const { count } = await db
      .from("comissao_previsoes_participantes")
      .select("id", { count: "exact", head: true })
      .eq("regra_participante_id", id);
    if (rule.configuracao_homologada || (count ?? 0) > 0)
      throw new Error(
        "Regra homologada/usada não pode ser excluída. Inative ou crie nova versão.",
      );
    const { error } = await db
      .from("comissao_regras_participantes")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw new Error(error.message);
  } else {
    const { data: rule } = await db
      .from("comissao_regras_franquia")
      .select("configuracao_homologada")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!rule) throw new Error("Regra não encontrada.");
    const [{ count }, { count: steps }] = await Promise.all([
      db
        .from("comissao_previsoes_franquia")
        .select("id", { count: "exact", head: true })
        .eq("regra_franquia_id", id),
      db
        .from("comissao_regra_etapas")
        .select("id", { count: "exact", head: true })
        .eq("regra_franquia_id", id),
    ]);
    if (rule.configuracao_homologada || (count ?? 0) > 0)
      throw new Error(
        "Regra homologada/usada não pode ser excluída. Inative ou crie nova versão.",
      );
    if ((steps ?? 0) > 0) {
      const { error: e } = await db
        .from("comissao_regra_etapas")
        .delete()
        .eq("regra_franquia_id", id);
      if (e) throw new Error(e.message);
    }
    const { error } = await db
      .from("comissao_regras_franquia")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/erp/regras-comissao");
}

export async function toggleCommissionRuleAction(
  formData: FormData,
): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  const id = String(formData.get("regra_id") ?? "");
  const kind = String(formData.get("tipo_regra") ?? "");
  const ativo = formData.get("ativo") === "true";
  const db = await assertCanWrite(empresaId);
  const table =
    kind === "PARTICIPANTE"
      ? "comissao_regras_participantes"
      : "comissao_regras_franquia";
  const { error } = await db
    .from(table)
    .update({ ativa: ativo })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);
  revalidatePath("/erp/regras-comissao");
}

export async function newCommissionRuleVersionAction(
  formData: FormData,
): Promise<void> {
  const empresaId = String(formData.get("empresa_id") ?? "");
  const id = String(formData.get("regra_id") ?? "");
  const kind = String(formData.get("tipo_regra") ?? "");
  const db = await assertCanWrite(empresaId);
  if (kind === "PARTICIPANTE") {
    const { data: source, error } = await db
      .from("comissao_regras_participantes")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error || !source) throw new Error("Regra não encontrada.");
    const { data: latest } = await db
      .from("comissao_regras_participantes")
      .select("versao")
      .eq("empresa_id", empresaId)
      .eq("programa_id", source.programa_id)
      .order("versao", { ascending: false })
      .limit(1);
    const copy: Record<string, unknown> = { ...source };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    const { error: insertError } = await db
      .from("comissao_regras_participantes")
      .insert({
        ...copy,
        versao: Number(latest?.[0]?.versao ?? source.versao) + 1,
        configuracao_homologada: false,
        origem_configuracao: "NOVA_VERSAO_ERP_NAO_HOMOLOGADA",
        ativa: true,
      });
    if (insertError) throw new Error(insertError.message);
  } else {
    const { data: source, error } = await db
      .from("comissao_regras_franquia")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error || !source) throw new Error("Regra não encontrada.");
    const [{ data: latest }, { data: steps }] = await Promise.all([
      db
        .from("comissao_regras_franquia")
        .select("versao")
        .eq("empresa_id", empresaId)
        .eq("programa_id", source.programa_id)
        .order("versao", { ascending: false })
        .limit(1),
      db
        .from("comissao_regra_etapas")
        .select("ordem,tipo_gatilho,mes_relativo,nome,percentual_venda")
        .eq("regra_franquia_id", id)
        .order("ordem"),
    ]);
    const copy: Record<string, unknown> = { ...source };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    const { data: created, error: insertError } = await db
      .from("comissao_regras_franquia")
      .insert({
        ...copy,
        versao: Number(latest?.[0]?.versao ?? source.versao) + 1,
        configuracao_homologada: false,
        origem_configuracao: "NOVA_VERSAO_PLATFORM_NAO_HOMOLOGADA",
        ativa: true,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    if (steps?.length) {
      const { error: stepError } = await db
        .from("comissao_regra_etapas")
        .insert(
          steps.map((step) => ({ ...step, regra_franquia_id: created.id })),
        );
      if (stepError) throw new Error(stepError.message);
    }
  }
  revalidatePath("/erp/regras-comissao");
}
