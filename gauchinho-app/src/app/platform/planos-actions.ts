"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

export async function criarPlanoPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const valorMensal = Number(formData.get("valor_mensal") ?? 0);
  const taxaImplantacao = Number(formData.get("taxa_implantacao") ?? 0);
  const limiteUsuarios = Number(formData.get("limite_usuarios") ?? 10);
  const erpIncluido = formData.get("erp_incluido") === "true";
  const sitePrincipalIncluido = formData.get("site_principal_incluido") !== "false";
  const permiteSitesParceiros = formData.get("permite_sites_parceiros") === "true";
  const maxParceiros = Number(formData.get("max_parceiros") ?? 0);
  const maxSitesParceiros = Number(formData.get("max_sites_parceiros") ?? 0);
  const maxSitesDominioProprio = Number(formData.get("max_sites_dominio_proprio") ?? 0);
  const valorSiteParceiro = Number(formData.get("valor_site_parceiro") ?? 0);
  const valorSiteDominioProprio = Number(formData.get("valor_site_dominio_proprio") ?? 0);

  let modulosCodigos: string[] = [];
  const rawModulos = formData.get("modulos_codigos_json");
  if (rawModulos) {
    try {
      modulosCodigos = JSON.parse(String(rawModulos));
    } catch {
      modulosCodigos = [];
    }
  }

  if (!nome) {
    return { status: "ERROR", message: "Nome do plano é obrigatório." };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_criar_plano", {
    p_nome: nome,
    p_codigo: codigo || null,
    p_descricao: descricao,
    p_valor_mensal: valorMensal,
    p_taxa_implantacao: taxaImplantacao,
    p_limite_usuarios: limiteUsuarios,
    p_erp_incluido: erpIncluido,
    p_site_principal_incluido: sitePrincipalIncluido,
    p_permite_sites_parceiros: permiteSitesParceiros,
    p_max_parceiros: maxParceiros,
    p_max_sites_parceiros: maxSitesParceiros,
    p_max_sites_dominio_proprio: maxSitesDominioProprio,
    p_valor_site_parceiro: valorSiteParceiro,
    p_valor_site_dominio_proprio: valorSiteDominioProprio,
    p_taxa_implantacao_site_parceiro: 0,
    p_taxa_implantacao_dominio_proprio: 0,
    p_modulos_codigos: modulosCodigos,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/planos");
  redirect(`/platform/planos/${data}`);
}

export async function salvarPlanoPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const valorMensal = Number(formData.get("valor_mensal") ?? 0);
  const taxaImplantacao = Number(formData.get("taxa_implantacao") ?? 0);
  const limiteUsuarios = Number(formData.get("limite_usuarios") ?? 10);
  const erpIncluido = formData.get("erp_incluido") === "true";
  const sitePrincipalIncluido = formData.get("site_principal_incluido") !== "false";
  const permiteSitesParceiros = formData.get("permite_sites_parceiros") === "true";
  const maxParceiros = Number(formData.get("max_parceiros") ?? 0);
  const maxSitesParceiros = Number(formData.get("max_sites_parceiros") ?? 0);
  const maxSitesDominioProprio = Number(formData.get("max_sites_dominio_proprio") ?? 0);
  const valorSiteParceiro = Number(formData.get("valor_site_parceiro") ?? 0);
  const valorSiteDominioProprio = Number(formData.get("valor_site_dominio_proprio") ?? 0);
  const taxaImplantacaoSiteParceiro = Number(formData.get("taxa_implantacao_site_parceiro") ?? 0);
  const taxaImplantacaoDominioProprio = Number(formData.get("taxa_implantacao_dominio_proprio") ?? 0);
  const disponivelNovasAssinaturas = formData.get("disponivel_novas_assinaturas") !== "false";
  const categoria = String(formData.get("categoria") ?? "PADRAO").trim();

  let modulosCodigos: string[] = [];
  const rawModulos = formData.get("modulos_codigos_json");
  if (rawModulos) {
    try {
      modulosCodigos = JSON.parse(String(rawModulos));
    } catch {
      modulosCodigos = [];
    }
  }

  if (!id || !nome) {
    return { status: "ERROR", message: "ID e Nome do plano são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_salvar_plano", {
    p_id: id,
    p_nome: nome,
    p_descricao: descricao,
    p_valor_mensal: valorMensal,
    p_taxa_implantacao: taxaImplantacao,
    p_limite_usuarios: limiteUsuarios,
    p_erp_incluido: erpIncluido,
    p_site_principal_incluido: sitePrincipalIncluido,
    p_permite_sites_parceiros: permiteSitesParceiros,
    p_max_parceiros: maxParceiros,
    p_max_sites_parceiros: maxSitesParceiros,
    p_max_sites_dominio_proprio: maxSitesDominioProprio,
    p_valor_site_parceiro: valorSiteParceiro,
    p_valor_site_dominio_proprio: valorSiteDominioProprio,
    p_taxa_implantacao_site_parceiro: taxaImplantacaoSiteParceiro,
    p_taxa_implantacao_dominio_proprio: taxaImplantacaoDominioProprio,
    p_disponivel_novas_assinaturas: disponivelNovasAssinaturas,
    p_categoria: categoria,
    p_modulos_codigos: modulosCodigos,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath(`/platform/planos/${id}`);
  revalidatePath("/platform/planos");
  return { status: "SUCCESS", message: "Plano SaaS atualizado com sucesso." };
}

export async function statusPlanoPlatformAction(
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
  const { error } = await db.rpc("rpc_platform_status_plano", {
    p_id: id,
    p_status: status,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath(`/platform/planos/${id}`);
  revalidatePath("/platform/planos");
  return { status: "SUCCESS", message: `Status do plano alterado para ${status}.` };
}

export async function duplicarPlanoPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const planoId = String(formData.get("plano_id") ?? "").trim();
  const novoNome = String(formData.get("novo_nome") ?? "").trim() || null;

  if (!planoId) {
    return { status: "ERROR", message: "ID do plano é obrigatório." };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_duplicar_plano", {
    p_plano_id: planoId,
    p_novo_nome: novoNome,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/planos");
  redirect(`/platform/planos/${data}`);
}
