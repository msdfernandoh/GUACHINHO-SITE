"use server";
import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

export async function createMasterFranquiaAction(formData: FormData) {
  if (!(await isPlatformSuperadmin())) throw new Error("Acesso restrito ao Platform Superadmin.");
  const nome = String(formData.get("nome_fantasia") ?? "").trim();
  const razao = String(formData.get("razao_social") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!nome || !razao || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Dados da empresa ou slug inválidos.");
  const db = await createClient();
  const { data, error } = await db
    .from("empresas")
    .insert({
      nome_fantasia: nome,
      razao_social: razao,
      slug,
      cnpj: String(formData.get("cnpj") ?? "").trim() || null,
      status: "em_treinamento",
      ativo: false,
      configuracoes: {},
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/platform/empresas/${data.id}`);
}

export async function onboardingMasterFranquiaAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  const cidade = String(formData.get("cidade") ?? "").trim() || null;
  const estado = String(formData.get("estado") ?? "").trim() || null;

  const modeloSiteId = String(formData.get("modelo_site_id") ?? "").trim() || null;
  const usarLogoPropria = formData.get("usar_logo_propria") === "true";
  const logoUrl = String(formData.get("logo_url") ?? "").trim() || null;

  let menusHabilitados: string[] = [];
  const rawMenus = formData.get("menus_habilitados_json");
  if (rawMenus) {
    try {
      menusHabilitados = JSON.parse(String(rawMenus));
    } catch {
      menusHabilitados = [];
    }
  }

  const erpHabilitado = formData.get("erp_habilitado") !== "false";
  let modulosErp: string[] = [];
  const rawModulos = formData.get("modulos_erp_json");
  if (rawModulos) {
    try {
      modulosErp = JSON.parse(String(rawModulos));
    } catch {
      modulosErp = [];
    }
  }

  const rawLimite = Number(formData.get("limite_usuarios") ?? 10);
  const limiteUsuarios = isNaN(rawLimite) || rawLimite <= 0 ? 10 : rawLimite;

  const responsavelNome = String(formData.get("responsavel_nome") ?? "").trim() || null;
  const responsavelEmail = String(formData.get("responsavel_email") ?? "").trim() || null;
  const responsavelTelefone = String(formData.get("responsavel_telefone") ?? "").trim() || null;

  let administradorasIds: string[] = [];
  const rawAdmins = formData.get("administradoras_ids_json");
  if (rawAdmins) {
    try {
      administradorasIds = JSON.parse(String(rawAdmins));
    } catch {
      administradorasIds = [];
    }
  }

  const planoId = String(formData.get("plano_id") ?? "").trim() || null;
  const sitesParceirosContratados = Number(formData.get("sites_parceiros_contratados") ?? 0);
  const sitesDominioProprioContratados = Number(formData.get("sites_dominio_proprio_contratados") ?? 0);

  if (!nomeFantasia || !razaoSocial) {
    return { status: "ERROR", message: "Nome fantasia e Razão social são obrigatórios." };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_onboarding_master_franquia", {
    p_nome_fantasia: nomeFantasia,
    p_razao_social: razaoSocial,
    p_slug: slug || null,
    p_cnpj: cnpj,
    p_email: email,
    p_telefone: telefone,
    p_whatsapp: whatsapp,
    p_cidade: cidade,
    p_estado: estado,
    p_modelo_site_id: modeloSiteId,
    p_usar_logo_propria: usarLogoPropria,
    p_logo_url: logoUrl,
    p_menus_habilitados: menusHabilitados,
    p_erp_habilitado: erpHabilitado,
    p_modulos_erp: modulosErp,
    p_limite_usuarios: limiteUsuarios,
    p_responsavel_nome: responsavelNome,
    p_responsavel_email: responsavelEmail,
    p_responsavel_telefone: responsavelTelefone,
    p_administradoras_ids: administradorasIds,
    p_plano_id: planoId,
    p_sites_parceiros_contratados: sitesParceirosContratados,
    p_sites_dominio_proprio_contratados: sitesDominioProprioContratados,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  redirect(`/platform/empresas/${data}`);
}

export async function atualizarDadosEmpresaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const cidade = String(formData.get("cidade") ?? "").trim() || null;
  const estado = String(formData.get("estado") ?? "").trim() || null;

  if (!id || !nomeFantasia || !razaoSocial) {
    return { status: "ERROR", message: "ID, Nome fantasia e Razão social são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_atualizar_dados_empresa", {
    p_empresa_id: id,
    p_nome_fantasia: nomeFantasia,
    p_razao_social: razaoSocial,
    p_cnpj: cnpj,
    p_telefone: telefone,
    p_whatsapp: whatsapp,
    p_email: email,
    p_cidade: cidade,
    p_estado: estado,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Dados cadastrais da franquia atualizados com sucesso." };
}

export async function ativarEmpresaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { status: "ERROR", message: "ID da empresa é obrigatório." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_ativar_empresa", {
    p_empresa_id: id,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Master Franquia ativada com sucesso em Produção." };
}

export async function suspenderEmpresaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  if (!id || !motivo) {
    return { status: "ERROR", message: "ID da empresa e motivo da suspensão são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_suspender_empresa", {
    p_empresa_id: id,
    p_motivo: motivo,
    p_observacao: observacao,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Master Franquia suspensa. Todos os dados foram preservados." };
}

export async function reativarEmpresaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { status: "ERROR", message: "ID da empresa é obrigatório." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_reativar_empresa", {
    p_empresa_id: id,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Master Franquia reativada com sucesso." };
}

export async function alterarPlanoEmpresaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const novoPlanoId = String(formData.get("novo_plano_id") ?? "").trim();
  const usuarios = formData.get("usuarios_contratados") ? Number(formData.get("usuarios_contratados")) : null;
  const sites = formData.get("sites_parceiros_contratados") ? Number(formData.get("sites_parceiros_contratados")) : null;
  const dominios = formData.get("sites_dominio_proprio_contratados") ? Number(formData.get("sites_dominio_proprio_contratados")) : null;

  if (!empresaId || !novoPlanoId) {
    return { status: "ERROR", message: "Empresa e Novo Plano são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_alterar_plano_empresa", {
    p_empresa_id: empresaId,
    p_novo_plano_id: novoPlanoId,
    p_usuarios_contratados: usuarios,
    p_sites_parceiros_contratados: sites,
    p_sites_dominio_proprio_contratados: dominios,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Plano SaaS e quotas da empresa alterados com sucesso." };
}

export async function alterarModeloEmpresaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const novoModeloId = String(formData.get("novo_modelo_id") ?? "").trim();

  if (!empresaId || !novoModeloId) {
    return { status: "ERROR", message: "Empresa e Novo Modelo de Site são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_alterar_modelo_empresa", {
    p_empresa_id: empresaId,
    p_novo_modelo_id: novoModeloId,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Modelo de site da franquia alterado com sucesso." };
}

export async function concederAdministradoraEmpresaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const administradoraId = String(formData.get("administradora_id") ?? "").trim();

  if (!empresaId || !administradoraId) {
    return { status: "ERROR", message: "Empresa e Administradora são obrigatórias." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_conceder_administradora_empresa", {
    p_empresa_id: empresaId,
    p_administradora_id: administradoraId,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Administradora concedida com sucesso à Master Franquia." };
}

export async function revogarAdministradoraEmpresaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const administradoraId = String(formData.get("administradora_id") ?? "").trim();
  const status = String(formData.get("status") ?? "INATIVA").trim();

  if (!empresaId || !administradoraId) {
    return { status: "ERROR", message: "Empresa e Administradora são obrigatórias." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_revogar_administradora_empresa", {
    p_empresa_id: empresaId,
    p_administradora_id: administradoraId,
    p_status: status,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: `Concessão da administradora alterada para ${status}.` };
}

export async function criarSiteParceiroEmpresaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const orgId = String(formData.get("organizacao_parceira_id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const nomeSite = String(formData.get("nome_site") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  const canal = String(formData.get("canal") ?? "SUBDOMINIO").trim();

  if (!empresaId || !orgId || !slug || !nomeSite) {
    return { status: "ERROR", message: "Empresa, Organização, Slug e Nome do Site são obrigatórios." };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_criar_site_parceiro", {
    p_empresa_id: empresaId,
    p_organizacao_parceira_id: orgId,
    p_slug: slug,
    p_nome_site: nomeSite,
    p_whatsapp: whatsapp,
    p_canal: canal,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Site de parceiro criado com sucesso.", data };
}



