/** Permissões Fase 4 — somente `super_admin` no seed 047. */
export const FASE4_PERMISSOES = {
  gerenciarCatalogoAdministradoras: "gerenciar_catalogo_administradoras",
  gerenciarAdministradorasEmpresa: "gerenciar_administradoras_empresa",
} as const;

export const ADMINISTRADORA_STATUS = {
  ATIVA: "ATIVA",
  INATIVA: "INATIVA",
} as const;

export const EMPRESA_ADMINISTRADORA_STATUS = {
  ATIVA: "ATIVA",
  INATIVA: "INATIVA",
  SUSPENSA: "SUSPENSA",
} as const;

/** UUID estável seed E1 — administradora global Racon. */
export const RACON_ADMINISTRADORA_ID = "c5f8ecb4-cb5a-5014-b567-50484719b404";
export const RACON_SLUG = "racon";

/** Tenant Gauchinho (empresa/franqueada), não administradora. */
export const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
export const EMPRESA_B_ID = "8e4e13f9-80e6-44db-a21b-584a43b6f024";

export const AUDIT_ACTIONS_ADMINISTRADORAS = {
  criada: "ADMINISTRADORA_GLOBAL_CRIADA",
  editada: "ADMINISTRADORA_GLOBAL_ATUALIZADA",
  statusAlterado: "ADMINISTRADORA_GLOBAL_STATUS_ALTERADO",
  concessaoCriada: "empresa_administradora.concessao_criada",
  concessaoSuspensa: "empresa_administradora.concessao_suspensa",
  concessaoReativada: "empresa_administradora.concessao_reativada",
  concessaoConfigAlterada: "empresa_administradora.configuracao_alterada",
} as const;

/** Chaves proibidas em JSON de integração/metadata (credenciais ficam para vínculo empresa). */
export const ADMINISTRADORA_JSON_FORBIDDEN_KEY_RE =
  /(api[_-]?key|client[_-]?secret|password|passwd|token|webhook[_-]?secret|secret)/i;

/** Mensagem uniforme (404 semântico) — não revelar existência sem autorização. */
export const ADMINISTRADORA_NOT_FOUND_MESSAGE = "Administradora não encontrada.";
