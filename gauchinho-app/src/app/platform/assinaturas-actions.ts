"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

export async function criarAssinaturaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const planoId = String(formData.get("plano_id") ?? "").trim();
  const status = String(formData.get("status") ?? "ATIVA").trim().toUpperCase();
  const usuariosContratados = Number(formData.get("usuarios_contratados") ?? 10);
  const sitesParceirosContratados = Number(formData.get("sites_parceiros_contratados") ?? 0);
  const sitesDominioProprioContratados = Number(formData.get("sites_dominio_proprio_contratados") ?? 0);
  const valorMensal = formData.get("valor_mensal") ? Number(formData.get("valor_mensal")) : null;
  const taxaImplantacao = formData.get("taxa_implantacao") ? Number(formData.get("taxa_implantacao")) : 0;
  const dataInicio = String(formData.get("data_inicio") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  if (!empresaId || !planoId) {
    return { status: "ERROR", message: "Selecione a Master Franquia e o Plano SaaS." };
  }

  const db = await createClient();

  // 1. Obter dados do plano para calcular valor total estimado
  const { data: plano } = await db
    .from("saas_planos")
    .select("id, nome, valor_mensal, valor_site_parceiro, valor_site_dominio_proprio")
    .eq("id", planoId)
    .single();

  const valorBase = valorMensal !== null ? valorMensal : Number(plano?.valor_mensal || 0);
  const valorAdicionalSites = sitesParceirosContratados * Number(plano?.valor_site_parceiro || 0);
  const valorAdicionalDominios = sitesDominioProprioContratados * Number(plano?.valor_site_dominio_proprio || 0);
  const valorTotalEstimado = valorBase + valorAdicionalSites + valorAdicionalDominios;

  // 2. Inserir em saas_assinaturas
  const { error: assError } = await db
    .from("saas_assinaturas")
    .insert({
      empresa_id: empresaId,
      plano_id: planoId,
      status,
      usuarios_contratados: usuariosContratados,
      sites_parceiros_contratados: sitesParceirosContratados,
      sites_dominio_proprio_contratados: sitesDominioProprioContratados,
      valor_mensal: valorBase,
      taxa_implantacao: taxaImplantacao,
      valor_total_estimado: valorTotalEstimado,
      data_inicio: dataInicio,
      observacao,
    });

  if (assError) {
    return { status: "ERROR", message: `Erro ao criar assinatura: ${assError.message}` };
  }

  // 3. Sincronizar quotas operacionais da empresa
  try {
    await db
      .from("empresa_quotas")
      .upsert(
        {
          empresa_id: empresaId,
          limite_usuarios: usuariosContratados,
          limite_sites_parceiros: sitesParceirosContratados,
          limite_dominios_proprios: sitesDominioProprioContratados,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "empresa_id" }
      );
  } catch {
    // Quotas são complementares
  }

  revalidatePath("/platform/assinaturas");
  revalidatePath("/platform/empresas");
  revalidatePath(`/platform/empresas/${empresaId}`);
  revalidatePath("/platform");

  return { status: "SUCCESS", message: "Assinatura vinculada com sucesso à Master Franquia." };
}

export async function salvarAssinaturaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const planoId = String(formData.get("plano_id") ?? "").trim();
  const status = String(formData.get("status") ?? "ATIVA").trim();
  const usuariosContratados = Number(formData.get("usuarios_contratados") ?? 10);
  const sitesParceirosContratados = Number(formData.get("sites_parceiros_contratados") ?? 0);
  const sitesDominioProprioContratados = Number(formData.get("sites_dominio_proprio_contratados") ?? 0);
  const valorMensal = formData.get("valor_mensal") ? Number(formData.get("valor_mensal")) : null;
  const taxaImplantacao = formData.get("taxa_implantacao") ? Number(formData.get("taxa_implantacao")) : null;
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  if (!id || !planoId) {
    return { status: "ERROR", message: "ID da assinatura e do plano são obrigatórios." };
  }

  const db = await createClient();

  // Tentar via RPC
  const { error: rpcError } = await db.rpc("rpc_platform_salvar_assinatura", {
    p_id: id,
    p_plano_id: planoId,
    p_status: status,
    p_usuarios_contratados: usuariosContratados,
    p_sites_parceiros_contratados: sitesParceirosContratados,
    p_sites_dominio_proprio_contratados: sitesDominioProprioContratados,
    p_valor_mensal: valorMensal,
    p_taxa_implantacao: taxaImplantacao,
    p_observacao: observacao,
  });

  if (rpcError) {
    // Fallback com update direto caso a RPC não esteja disponível
    const { data: assAtual } = await db
      .from("saas_assinaturas")
      .select("empresa_id")
      .eq("id", id)
      .single();

    const { data: plano } = await db
      .from("saas_planos")
      .select("valor_mensal, valor_site_parceiro, valor_site_dominio_proprio")
      .eq("id", planoId)
      .single();

    const valorBase = valorMensal !== null ? valorMensal : Number(plano?.valor_mensal || 0);
    const valorAdicionalSites = sitesParceirosContratados * Number(plano?.valor_site_parceiro || 0);
    const valorAdicionalDominios = sitesDominioProprioContratados * Number(plano?.valor_site_dominio_proprio || 0);
    const valorTotalEstimado = valorBase + valorAdicionalSites + valorAdicionalDominios;

    const { error: directError } = await db
      .from("saas_assinaturas")
      .update({
        plano_id: planoId,
        status,
        usuarios_contratados: usuariosContratados,
        sites_parceiros_contratados: sitesParceirosContratados,
        sites_dominio_proprio_contratados: sitesDominioProprioContratados,
        valor_mensal: valorBase,
        taxa_implantacao: taxaImplantacao,
        valor_total_estimado: valorTotalEstimado,
        observacao,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (directError) {
      return { status: "ERROR", message: directError.message };
    }

    if (assAtual?.empresa_id) {
      try {
        await db
          .from("empresa_quotas")
          .upsert(
            {
              empresa_id: assAtual.empresa_id,
              limite_usuarios: usuariosContratados,
              limite_sites_parceiros: sitesParceirosContratados,
              limite_dominios_proprios: sitesDominioProprioContratados,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "empresa_id" }
          );
      } catch {
        // Quotas opcionais
      }
    }
  }

  revalidatePath("/platform/assinaturas");
  revalidatePath("/platform/empresas");
  return { status: "SUCCESS", message: "Assinatura da Master Franquia atualizada com sucesso." };
}

export async function alterarStatusAssinaturaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim().toUpperCase();

  if (!id || !status) {
    return { status: "ERROR", message: "ID e Status são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db
    .from("saas_assinaturas")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/assinaturas");
  return { status: "SUCCESS", message: `Status da assinatura alterado para ${status}.` };
}

