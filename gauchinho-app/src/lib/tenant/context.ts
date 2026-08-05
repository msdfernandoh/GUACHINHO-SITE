import { createClient } from "@/lib/supabase/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";

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
  empresa?: Empresa;
  papel?: Papel;
};

/** Empresa default de fallback da plataforma (Gauchinho Consórcios). */
export const DEFAULT_TENANT_SLUG = "gauchinho";

/**
 * Busca a empresa padrão da plataforma (Gauchinho Consórcios).
 */
export async function getDefaultCompany(): Promise<Empresa | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .eq("slug", DEFAULT_TENANT_SLUG)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Empresa;
}

/**
 * Retorna todas as empresas às quais o usuário informado possui vínculo ativo.
 */
export async function getUserCompanies(usuarioId: string): Promise<EmpresaUsuarioVinculo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
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

  if (error || !data) {
    return [];
  }

  return data as unknown as EmpresaUsuarioVinculo[];
}

/**
 * Resolve o contexto tenant atual para requisições no servidor.
 * Retorna o usuário logado, os vínculos de empresas e a empresa ativa.
 */
export async function getCurrentTenantContext() {
  const usuario = await getUsuarioNegocio();
  if (!usuario) {
    const defaultCompany = await getDefaultCompany();
    return {
      usuario: null,
      empresas: [],
      empresaAtiva: defaultCompany,
    };
  }

  const vinculos = await getUserCompanies(usuario.id);
  const defaultCompany = await getDefaultCompany();

  // Caso o usuário tenha vínculos, selecione o primeiro ativo ou fallback para a Gauchinho
  const empresaAtiva = vinculos.length > 0 && vinculos[0].empresa
    ? vinculos[0].empresa
    : defaultCompany;

  return {
    usuario,
    vinculos,
    empresaAtiva,
  };
}
