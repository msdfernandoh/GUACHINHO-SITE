/**
 * Perfis de negócio (tabela public.usuarios.perfil).
 * Autenticação: Supabase Auth (auth.users) → usuarios.auth_user_id
 */

export const PERFIS = [
  "master",
  "srd",
  "imobiliaria",
  "visualizador",
] as const;

export type Perfil = (typeof PERFIS)[number];

export type UsuarioNegocio = {
  id: string;
  auth_user_id: string | null;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  imobiliaria_id: string | null;
  admin_menus: string[] | null;
  leads_apenas_proprios: boolean;
};

export function isMaster(perfil: Perfil | null | undefined): boolean {
  return perfil === "master";
}

export function isStaff(perfil: Perfil | null | undefined): boolean {
  return perfil === "master" || perfil === "srd" || perfil === "visualizador";
}

export function canManageUsers(perfil: Perfil | null | undefined): boolean {
  return isMaster(perfil);
}

export function canEditSettings(perfil: Perfil | null | undefined): boolean {
  return isMaster(perfil);
}

export function canDeleteRecords(perfil: Perfil | null | undefined): boolean {
  return isMaster(perfil);
}

export function canManageGrupos(
  perfil: Perfil | null | undefined,
  srdPodeEditarGrupos?: boolean,
): boolean {
  if (isMaster(perfil)) return true;
  if (perfil === "srd" && srdPodeEditarGrupos) return true;
  return false;
}

export function canManageLeads(perfil: Perfil | null | undefined): boolean {
  return isStaff(perfil);
}

/** Documentos de contratações online — master, SRD e visualizador (não imobiliária). */
export function canAccessContratacaoDocumentos(perfil: Perfil | null | undefined): boolean {
  return isStaff(perfil);
}

export const MSG_SEM_PERMISSAO_DOCUMENTOS_CONTRATACAO =
  "Você não tem permissão para acessar documentos desta contratação.";

export function canCreateProposta(perfil: Perfil | null | undefined): boolean {
  return perfil === "master" || perfil === "srd";
}

export function isImobiliaria(perfil: Perfil | null | undefined): boolean {
  return perfil === "imobiliaria";
}

export function canManageImobiliarias(perfil: Perfil | null | undefined): boolean {
  return isMaster(perfil);
}

/** Conteúdo / prova social — master e SRD */
export function canManageConteudo(perfil: Perfil | null | undefined): boolean {
  return perfil === "master" || perfil === "srd";
}

export function canViewAllImoveis(perfil: Perfil | null | undefined): boolean {
  return isMaster(perfil) || perfil === "srd" || perfil === "visualizador";
}

/** Rotas admin permitidas para perfil imobiliária */
export function imobiliariaAdminPathAllowed(pathname: string): boolean {
  if (pathname === "/admin/minha-imobiliaria") return true;
  if (pathname === "/admin/imoveis") return true;
  if (pathname.startsWith("/admin/imoveis/")) return true;
  return false;
}
