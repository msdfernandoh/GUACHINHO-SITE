export type AdministradoraStatus = "ATIVA" | "INATIVA";
export type EmpresaAdministradoraStatus = "ATIVA" | "INATIVA" | "SUSPENSA";

/** Administradora GLOBAL da plataforma (ex.: Racon). Nunca é um tenant. */
export type Administradora = {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  razao_social: string | null;
  cnpj: string | null;
  slug: string;
  logo_url: string | null;
  site_url: string | null;
  status: AdministradoraStatus;
  recursos_integracao: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/**
 * Concessão PLATFORM_SUPERADMIN: empresa/franqueada × administradora global.
 * Não transforma a empresa em administradora.
 */
export type EmpresaAdministradora = {
  id: string;
  empresa_id: string;
  administradora_id: string;
  status: EmpresaAdministradoraStatus;
  codigo_franquia: string | null;
  codigo_comercial: string | null;
  contato_interno: string | null;
  observacoes: string | null;
  configuracoes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Visão segura para tenant: administradora autorizada + metadados mínimos do vínculo. */
export type AdministradoraAutorizada = {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  slug: string;
  logo_url: string | null;
  site_url: string | null;
  status: AdministradoraStatus;
  concessao: {
    id: string;
    empresa_id: string;
    status: EmpresaAdministradoraStatus;
  };
};
