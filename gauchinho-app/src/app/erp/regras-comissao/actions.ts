"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { commissionRuleScopesConflict, parseFranchiseRuleForm } from "@/lib/erp/commission-rule-input";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";

export type CommissionActionState = { ok: boolean; message: string };

async function assertCanWrite(empresaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_write_tenant_internal", { p_empresa_id: empresaId });
  if (error || !data) throw new Error("Somente o administrador da empresa ou o Platform Superadmin pode cadastrar regras.");
  return supabase;
}

export async function createCommissionProgramAction(_previous: CommissionActionState, formData: FormData): Promise<CommissionActionState> {
  try {
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    const nome = String(formData.get("nome") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim() || null;
    const administradoraId = String(formData.get("administradora_id") ?? "").trim();
    if (!empresaId || !nome || !administradoraId) throw new Error("Empresa, nome e administradora são obrigatórios.");

    const supabase = await assertCanWrite(empresaId);
    const { data: administradoraValida } = await supabase
      .from("grupos_consorcio")
      .select("id")
      .eq("administradora_id", administradoraId)
      .limit(1)
      .maybeSingle();
    if (!administradoraValida) throw new Error("A administradora precisa estar vinculada ao catálogo de grupos disponível.");

    const { error } = await supabase.from("comissao_programas").insert({
      empresa_id: empresaId,
      nome,
      descricao,
      administradora_id: administradoraId,
      ativo: true,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/regras-comissao");
    return { ok: true, message: "Programa criado. Agora cadastre quantas regras e versões forem necessárias." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível criar o programa." };
  }
}

export async function createFranchiseRuleAction(_previous: CommissionActionState, formData: FormData): Promise<CommissionActionState> {
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
    if (programaError || !programa) throw new Error("Programa não encontrado neste tenant.");
    if (!programa.administradora_id) throw new Error("O programa precisa ter uma administradora explícita.");

    if (input.opcaoCotaId) {
      const { data: cota } = await supabase
        .from("grupos_cotas")
        .select("id,grupo:grupos_consorcio!inner(administradora_id)")
        .eq("id", input.opcaoCotaId)
        .eq("grupo.administradora_id", programa.administradora_id)
        .maybeSingle();
      if (!cota) throw new Error("A opção de cota não pertence à administradora do programa.");
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

    const { error } = await supabase.from("comissao_regras_franquia").insert({
      empresa_id: empresaId,
      programa_id: input.programaId,
      versao,
      base_calculo: input.baseCalculo,
      percentual_total_comissao: input.baseCalculo === "credito" ? input.valor : null,
      valor_fixo_total: input.baseCalculo === "valor_fixo" ? input.valor : null,
      vigencia_inicio: input.vigenciaInicio,
      vigencia_fim: input.vigenciaFim,
      modalidade: input.modalidade,
      opcao_cota_id: input.opcaoCotaId,
      plano_condicao: input.planoCondicao,
      etapas_cronograma: input.etapas,
      ativa: true,
      configuracao_homologada: false,
      origem_configuracao: "ERP_MANUAL_NAO_HOMOLOGADO",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/regras-comissao");
    return { ok: true, message: `Regra v${versao} criada como rascunho não homologado. Ela ainda não participa dos cálculos.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível criar a regra." };
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
};

export async function homologateFranchiseRuleAction(formData: FormData): Promise<void> {
  if (!(await isPlatformSuperadmin())) throw new Error("Somente o Platform Superadmin pode homologar uma regra financeira.");
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const ruleId = String(formData.get("regra_id") ?? "").trim();
  if (!empresaId || !ruleId) throw new Error("Empresa e regra são obrigatórias.");
  const supabase = await assertCanWrite(empresaId);

  const { data: target, error: targetError } = await supabase
    .from("comissao_regras_franquia")
    .select("id,programa_id,vigencia_inicio,vigencia_fim,modalidade,opcao_cota_id,plano_condicao")
    .eq("id", ruleId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (targetError || !target) throw new Error("Regra não encontrada neste tenant.");

  const { data: targetProgram } = await supabase
    .from("comissao_programas")
    .select("administradora_id,ativo")
    .eq("id", target.programa_id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!targetProgram?.administradora_id || !targetProgram.ativo) throw new Error("O programa precisa estar ativo e possuir administradora explícita.");

  const { data: sameAdminPrograms, error: programsError } = await supabase
    .from("comissao_programas")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("administradora_id", targetProgram.administradora_id)
    .eq("ativo", true);
  if (programsError) throw new Error(programsError.message);
  const programIds = (sameAdminPrograms ?? []).map((program) => program.id as string);
  const { data: homologated, error: rulesError } = await supabase
    .from("comissao_regras_franquia")
    .select("id,programa_id,vigencia_inicio,vigencia_fim,modalidade,opcao_cota_id,plano_condicao")
    .eq("empresa_id", empresaId)
    .eq("ativa", true)
    .eq("configuracao_homologada", true)
    .in("programa_id", programIds);
  if (rulesError) throw new Error(rulesError.message);

  const candidate = target as HomologationRule;
  const conflict = (homologated as HomologationRule[] | null)?.find((rule) =>
    rule.id !== candidate.id
    && commissionRuleScopesConflict(
      { vigenciaInicio: rule.vigencia_inicio, vigenciaFim: rule.vigencia_fim, modalidade: rule.modalidade, opcaoCotaId: rule.opcao_cota_id, planoCondicao: rule.plano_condicao },
      { vigenciaInicio: candidate.vigencia_inicio, vigenciaFim: candidate.vigencia_fim, modalidade: candidate.modalidade, opcaoCotaId: candidate.opcao_cota_id, planoCondicao: candidate.plano_condicao },
    )
  );
  if (conflict) throw new Error("Homologação bloqueada: já existe regra homologada com a mesma precedência, escopo e vigência.");

  const { error } = await supabase
    .from("comissao_regras_franquia")
    .update({ configuracao_homologada: true })
    .eq("id", ruleId)
    .eq("empresa_id", empresaId)
    .eq("ativa", true);
  if (error) throw new Error(error.message);
  revalidatePath("/erp/regras-comissao");
}
