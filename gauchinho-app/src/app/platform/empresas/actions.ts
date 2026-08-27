"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";
import { formatUfInput, sanitizeCep, validarUfBr } from "@/lib/contratacoes-online/endereco";
import { sanitizeCnpj, sanitizeDigits, validarCnpj } from "@/lib/contratacoes-online/validacao";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

function normalizarCadastroEmpresa(formData: FormData) {
  const cnpj = sanitizeCnpj(String(formData.get("cnpj") ?? ""));
  const telefone = sanitizeDigits(String(formData.get("telefone") ?? "")).slice(0, 11);
  const whatsapp = sanitizeDigits(String(formData.get("whatsapp") ?? "")).slice(0, 11);
  const cep = sanitizeCep(String(formData.get("cep") ?? ""));
  const endereco = String(formData.get("endereco") ?? "").trim();
  const numero = String(formData.get("numero") ?? "").trim();
  const complemento = String(formData.get("complemento") ?? "").trim();
  const bairro = String(formData.get("bairro") ?? "").trim();
  const cidade = String(formData.get("cidade") ?? "").trim();
  const estado = formatUfInput(String(formData.get("estado") ?? ""));

  if (cnpj && !validarCnpj(cnpj)) throw new Error("CNPJ inválido. Confira os 14 dígitos.");
  if (telefone && ![10, 11].includes(telefone.length)) throw new Error("Telefone inválido. Informe DDD e número.");
  if (whatsapp && ![10, 11].includes(whatsapp.length)) throw new Error("WhatsApp inválido. Informe DDD e número.");

  const informouEndereco = Boolean(cep || endereco || numero || complemento || bairro || cidade || estado);
  if (informouEndereco) {
    if (cep.length !== 8) throw new Error("CEP inválido. Informe 8 dígitos.");
    if (!endereco || !numero || !bairro || !cidade || !validarUfBr(estado)) {
      throw new Error("Para salvar o endereço, informe logradouro, número, bairro, cidade e uma UF válida.");
    }
  }

  return {
    cnpj: cnpj || null,
    telefone: telefone || null,
    whatsapp: whatsapp || null,
    cep: cep || null,
    endereco: endereco || null,
    numero: numero || null,
    complemento: complemento || null,
    bairro: bairro || null,
    cidade: cidade || null,
    estado: estado || null,
  };
}

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
  let cadastro;
  try {
    cadastro = normalizarCadastroEmpresa(formData);
  } catch (error) {
    return { status: "ERROR", message: error instanceof Error ? error.message : "Dados cadastrais inválidos." };
  }
  const email = String(formData.get("email") ?? "").trim() || null;

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
    p_cnpj: cadastro.cnpj,
    p_email: email,
    p_telefone: cadastro.telefone,
    p_whatsapp: cadastro.whatsapp,
    p_cidade: cadastro.cidade,
    p_estado: cadastro.estado,
    p_cep: cadastro.cep,
    p_endereco: cadastro.endereco,
    p_numero: cadastro.numero,
    p_complemento: cadastro.complemento,
    p_bairro: cadastro.bairro,
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
  let cadastro;
  try {
    cadastro = normalizarCadastroEmpresa(formData);
  } catch (error) {
    return { status: "ERROR", message: error instanceof Error ? error.message : "Dados cadastrais inválidos." };
  }
  const email = String(formData.get("email") ?? "").trim() || null;

  if (!id || !nomeFantasia || !razaoSocial) {
    return { status: "ERROR", message: "ID, Nome fantasia e Razão social são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_atualizar_dados_empresa", {
    p_empresa_id: id,
    p_nome_fantasia: nomeFantasia,
    p_razao_social: razaoSocial,
    p_cnpj: cadastro.cnpj,
    p_telefone: cadastro.telefone,
    p_whatsapp: cadastro.whatsapp,
    p_email: email,
    p_cidade: cadastro.cidade,
    p_estado: cadastro.estado,
    p_cep: cadastro.cep,
    p_endereco: cadastro.endereco,
    p_numero: cadastro.numero,
    p_complemento: cadastro.complemento,
    p_bairro: cadastro.bairro,
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

  revalidatePath(`/platform/empresas/${empresaId}`);
  revalidatePath("/platform/empresas");
  return { status: "SUCCESS", message: "Modelo de site da franquia alterado com sucesso." };
}

export async function salvarQuadroSocietarioPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const rawSocios = String(formData.get("socios_json") ?? "[]");
  let socios: Array<Record<string, unknown>>;
  try {
    socios = JSON.parse(rawSocios) as Array<Record<string, unknown>>;
  } catch {
    return { status: "ERROR", message: "Configuração societária inválida." };
  }

  if (!empresaId || !Array.isArray(socios) || socios.length === 0) {
    return { status: "ERROR", message: "Informe a empresa e ao menos um sócio." };
  }
  const total = socios.reduce((soma, socio) => soma + Number(socio.percentual ?? 0), 0);
  if (Math.abs(total - 100) > 0.0001) {
    return { status: "ERROR", message: `A participação total precisa ser 100%. Total atual: ${total.toFixed(4)}%.` };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_salvar_quadro_societario", {
    p_empresa_id: empresaId,
    p_socios: socios,
  });
  if (error) return { status: "ERROR", message: error.message };

  revalidatePath(`/platform/empresas/${empresaId}`);
  revalidatePath("/erp/contas-pagar");
  return { status: "SUCCESS", message: "Quadro societário versionado e sincronizado com o ERP.", data };
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
  const modoIdentidade = String(formData.get("identidade_visual_modo") ?? "HERDAR_MASTER").trim();
  const corPrimaria = String(formData.get("cor_primaria") ?? "").trim() || null;
  const corSecundaria = String(formData.get("cor_secundaria") ?? "").trim() || null;
  const corDestaque = String(formData.get("cor_destaque") ?? "").trim() || null;
  const logoUrl = String(formData.get("logo_url") ?? "").trim() || null;

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
    p_identidade_visual_modo: modoIdentidade,
    p_cor_primaria: corPrimaria,
    p_cor_secundaria: corSecundaria,
    p_cor_destaque: corDestaque,
    p_logo_url: logoUrl,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Site de parceiro criado com sucesso.", data };
}

export async function salvarIdentidadeSiteParceiroPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const siteId = String(formData.get("site_id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const modo = String(formData.get("identidade_visual_modo") ?? "HERDAR_MASTER").trim();

  const logoUrl = String(formData.get("logo_url") ?? "").trim() || null;
  const corPrimaria = String(formData.get("cor_primaria") ?? "").trim() || null;
  const corSecundaria = String(formData.get("cor_secundaria") ?? "").trim() || null;
  const corDestaque = String(formData.get("cor_destaque") ?? "").trim() || null;
  const fotoPerfilUrl = String(formData.get("foto_perfil_url") ?? "").trim() || null;
  const bannerUrl = String(formData.get("banner_url") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  const instagram = String(formData.get("instagram") ?? "").trim() || null;
  const textoHero = String(formData.get("texto_hero") ?? "").trim() || null;
  const textoSobre = String(formData.get("texto_sobre") ?? "").trim() || null;

  if (!siteId || !empresaId) {
    return { status: "ERROR", message: "Site ID e Empresa ID são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_salvar_identidade_site_parceiro", {
    p_site_id: siteId,
    p_empresa_id: empresaId,
    p_identidade_visual_modo: modo,
    p_logo_url: logoUrl,
    p_cor_primaria: corPrimaria,
    p_cor_secundaria: corSecundaria,
    p_cor_destaque: corDestaque,
    p_foto_perfil_url: fotoPerfilUrl,
    p_banner_url: bannerUrl,
    p_telefone: telefone,
    p_whatsapp: whatsapp,
    p_instagram: instagram,
    p_texto_hero: textoHero,
    p_texto_sobre: textoSobre,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return {
    status: "SUCCESS",
    message:
      modo === "HERDAR_MASTER"
        ? "Identidade visual revertida para a herança da Master Franquia com sucesso."
        : "Overrides de identidade visual do parceiro salvos com sucesso.",
  };
}



