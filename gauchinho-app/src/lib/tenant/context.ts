import "server-only";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isMissingErpUserLinkColumns } from "@/lib/erp/migration-077-compat";
import { TENANT_EMPRESA_ID_HEADER, TENANT_SLUG_HEADER } from "@/lib/tenant/constants";

export type Empresa = {
  id: string;
  slug: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string | null;
  status: "ativo" | "suspenso" | "cancelado" | "em_treinamento";
  ativo: boolean;
  configuracoes?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Papel = {
  id: string;
  codigo: string;
  nome: string;
  escopo: "PLATFORM" | "COMPANY";
};

export type EmpresaUsuarioVinculo = {
  id: string;
  empresa_id: string;
  usuario_id: string;
  papel_id: string;
  ativo: boolean;
  imobiliaria_id?: string | null;
  socio_pagador?: boolean;
  pode_estornar_contas?: boolean;
  is_consultor?: boolean | null;
  leads_apenas_proprios?: boolean | null;
  agenda_acesso_todos?: boolean | null;
  google_agenda_sync?: boolean | null;
  admin_menus?: string[] | null;
  erp_modulos_visiveis?: string[] | null;
  empresa?: Empresa;
  papel?: Papel;
};

export type TenantPermissionCode =
  | "gerenciar_empresa_atual"
  | "gerenciar_usuarios"
  | "gerenciar_configuracoes"
  | "gerenciar_grupos"
  | "gerenciar_leads"
  | "gerenciar_propostas"
  | "acessar_agenda"
  | "acessar_relatorios"
  | "gerenciar_comissoes"
  | "gerenciar_financeiro"
  | "gerenciar_sites"
  | "gerenciar_imoveis"
  | "formalizar_vendas";

export type CurrentTenantContext = {
  usuario: Awaited<ReturnType<typeof getUsuarioNegocio>>;
  vinculos: EmpresaUsuarioVinculo[];
  vinculoAtivo: EmpresaUsuarioVinculo | null;
  empresaAtiva: Empresa | null;
  permissoes: ReadonlySet<string>;
};

/**
 * Retorna todas as empresas às quais o usuário informado possui vínculo ativo.
 */
export async function getUserCompanies(usuarioId: string): Promise<EmpresaUsuarioVinculo[]> {
  const supabase = await createClient();
  const extended = await supabase
    .from("empresa_usuarios")
    .select(`
      id,
      empresa_id,
      usuario_id,
      papel_id,
      ativo,
      imobiliaria_id,
      socio_pagador,
      pode_estornar_contas,
      is_consultor,
      leads_apenas_proprios,
      agenda_acesso_todos,
      google_agenda_sync,
      admin_menus,
      erp_modulos_visiveis,
      empresa:empresas(*),
      papel:papeis(*)
    `)
    .eq("usuario_id", usuarioId)
    .eq("ativo", true);

  if (!extended.error) {
    return ((extended.data ?? []) as unknown as EmpresaUsuarioVinculo[]).filter(
      (vinculo) =>
        Boolean(vinculo.empresa?.ativo) &&
        (vinculo.empresa?.status === "ativo" || vinculo.empresa?.status === "em_treinamento"),
    );
  }

  if (!isMissingErpUserLinkColumns(extended.error)) return [];

  const legacy = await supabase
    .from("empresa_usuarios")
    .select(`
      id,
      empresa_id,
      usuario_id,
      papel_id,
      ativo,
      empresa:empresas(*),
      papel:papeis(*)
    `)
    .eq("usuario_id", usuarioId)
    .eq("ativo", true);
  if (legacy.error || !legacy.data) return [];
  return legacy.data
    .map((vinculo) => ({
      ...(vinculo as unknown as EmpresaUsuarioVinculo),
    socio_pagador: false,
    pode_estornar_contas: false,
    is_consultor: null,
    leads_apenas_proprios: null,
    agenda_acesso_todos: null,
    google_agenda_sync: null,
    admin_menus: null,
    erp_modulos_visiveis: null,
    }))
    .filter(
      (vinculo) =>
        Boolean(vinculo.empresa?.ativo) &&
        (vinculo.empresa?.status === "ativo" || vinculo.empresa?.status === "em_treinamento"),
    );
}

async function getRolePermissions(papelId: string): Promise<ReadonlySet<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("papel_permissoes")
    .select("permissao:permissoes(codigo)")
    .eq("papel_id", papelId);

  if (error) return new Set<string>();
  return new Set(
    (data ?? []).flatMap((row) => {
      const permissao = Array.isArray(row.permissao) ? row.permissao[0] : row.permissao;
      return permissao?.codigo ? [String(permissao.codigo)] : [];
    }),
  );
}

/**
 * Resolve o contexto tenant atual para requisições no servidor.
 * Retorna o usuário logado, os vínculos de empresas e a empresa ativa.
 */
export async function getCurrentTenantContext(): Promise<CurrentTenantContext> {
  const usuario = await getUsuarioNegocio();
  if (!usuario) return {
    usuario: null,
    vinculos: [],
    vinculoAtivo: null,
    empresaAtiva: null,
    permissoes: new Set<string>(),
  };

  const requestHeaders = await headers();
  const empresaId = requestHeaders.get(TENANT_EMPRESA_ID_HEADER);
  const tenantSlug = requestHeaders.get(TENANT_SLUG_HEADER);
  const vinculos = await getUserCompanies(usuario.id);
  const vinculoAtivo = empresaId && tenantSlug
    ? vinculos.find(
        (vinculo) =>
          vinculo.empresa_id === empresaId &&
          vinculo.empresa?.id === empresaId &&
          vinculo.empresa.slug === tenantSlug,
      ) ?? null
    : null;
  const empresaAtiva = vinculoAtivo?.empresa ?? null;
  const permissoes = vinculoAtivo
    ? await getRolePermissions(vinculoAtivo.papel_id)
    : new Set<string>();

  return {
    usuario: vinculoAtivo
      ? {
          ...usuario,
          admin_menus: vinculoAtivo.admin_menus ?? usuario.admin_menus,
          leads_apenas_proprios:
            vinculoAtivo.leads_apenas_proprios ?? usuario.leads_apenas_proprios,
          agenda_acesso_todos:
            vinculoAtivo.agenda_acesso_todos ?? usuario.agenda_acesso_todos,
          imobiliaria_id: vinculoAtivo.imobiliaria_id ?? usuario.imobiliaria_id,
        }
      : usuario,
    vinculos,
    vinculoAtivo,
    empresaAtiva,
    permissoes,
  };
}

/** Exige uma empresa resolvida pelo host e um vínculo ativo do usuário nela. */
export async function requireCurrentTenantContext(): Promise<
  CurrentTenantContext & {
    usuario: NonNullable<CurrentTenantContext["usuario"]>;
    vinculoAtivo: EmpresaUsuarioVinculo;
    empresaAtiva: Empresa;
  }
> {
  const context = await getCurrentTenantContext();
  if (!context.usuario) throw new Error("Não autenticado ou usuário inativo");
  if (!context.empresaAtiva || !context.vinculoAtivo) {
    throw new Error("Usuário sem vínculo ativo com a empresa deste domínio");
  }
  return context as CurrentTenantContext & {
    usuario: NonNullable<CurrentTenantContext["usuario"]>;
    vinculoAtivo: EmpresaUsuarioVinculo;
    empresaAtiva: Empresa;
  };
}

/** Autorização tenant canônica. Não consulta usuarios.perfil. */
export async function requireTenantPermission(
  permissao: TenantPermissionCode,
): Promise<Awaited<ReturnType<typeof requireCurrentTenantContext>>> {
  const context = await requireCurrentTenantContext();
  const isMasterUser =
    context.usuario.perfil === "master" ||
    context.usuario.perfil === "admin" ||
    context.vinculoAtivo?.papel?.nome?.toLowerCase().includes("master") ||
    context.vinculoAtivo?.papel?.nome?.toLowerCase().includes("administrador") ||
    context.vinculoAtivo?.papel?.nome?.toLowerCase().includes("sócio") ||
    context.vinculoAtivo?.papel?.nome?.toLowerCase().includes("socio");

  if (!context.permissoes.has(permissao) && !isMasterUser) {
    throw new Error("Sem permissão para executar esta operação nesta empresa");
  }
  return context;
}
