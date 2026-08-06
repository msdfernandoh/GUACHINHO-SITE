/** Feature flag: rotas admin de participantes/orgs só operam com migration 045 + flag. */
export const FASE3_ADMIN_PARTICIPANTES_ENABLED =
  process.env.FASE3_ADMIN_PARTICIPANTES_ENABLED === "true";

export const PARTICIPANTE_STATUS = [
  "RASCUNHO",
  "ATIVO",
  "INATIVO",
  "SUSPENSO",
  "DESLIGADO",
] as const;

export type ParticipanteStatus = (typeof PARTICIPANTE_STATUS)[number];

export const PARTICIPANTE_TIPOS = [
  "GESTOR",
  "CONSULTOR",
  "VENDEDOR",
  "ATENDENTE",
  "INDICADOR",
  "RESPONSAVEL_PARCEIRO",
] as const;

export type ParticipanteTipoCodigo = (typeof PARTICIPANTE_TIPOS)[number];

export const ORGANIZACAO_TIPOS = [
  "PARCEIRO_COMERCIAL",
  "IMOBILIARIA",
  "CONTABILIDADE",
  "CORRETORA_DE_SEGUROS",
  "EMPRESA_DE_SERVICOS",
  "ASSOCIACAO",
  "INDICADOR_EMPRESARIAL",
  "OUTRO",
] as const;

export type OrganizacaoTipo = (typeof ORGANIZACAO_TIPOS)[number];

export const ORGANIZACAO_STATUS = [
  "RASCUNHO",
  "ATIVA",
  "INATIVA",
  "SUSPENSA",
  "ENCERRADA",
] as const;

export type OrganizacaoStatus = (typeof ORGANIZACAO_STATUS)[number];

export const PARCEIRO_SITE_STATUS = [
  "RASCUNHO",
  "AGUARDANDO_APROVACAO",
  "PUBLICADO",
  "SUSPENSO",
  "ARQUIVADO",
] as const;

export const PARCEIRO_DOMINIO_TIPOS = [
  "DOMINIO_PROPRIO",
  "SUBDOMINIO_EMPRESA",
  "ALIAS",
] as const;

/** Permissões conceituais da Fase 3 */
export const FASE3_PERMISSOES = {
  gerenciarParticipantes: "gerenciar_participantes",
  gerenciarOrganizacoes: "gerenciar_organizacoes_parceiras",
  gerenciarSites: "gerenciar_sites_parceiros",
  acessarAreaParceiro: "acessar_area_parceiro",
  visualizarLeads: "visualizar_leads_parceiro",
  criarLeads: "criar_leads_parceiro",
  editarLeads: "editar_leads_parceiro",
  visualizarPropostas: "visualizar_propostas_parceiro",
  criarPropostas: "criar_propostas_parceiro",
  editarPropostas: "editar_propostas_parceiro",
} as const;

/** Papel SaaS novo — não reutiliza parceiro_imobiliaria */
export const PAPEL_PARCEIRO_COMERCIAL = "parceiro_comercial";
export const PAPEL_PARCEIRO_IMOBILIARIA_LEGADO = "parceiro_imobiliaria";

/**
 * Matriz papel → permissão (espelha seed da migration 045).
 * parceiro_comercial NUNCA recebe permissões de site/DNS/branding.
 */
export const FASE3_PAPEL_PERMISSOES: Record<string, readonly string[]> = {
  super_admin: Object.values(FASE3_PERMISSOES),
  admin_empresa: Object.values(FASE3_PERMISSOES),
  parceiro_comercial: [
    FASE3_PERMISSOES.acessarAreaParceiro,
    FASE3_PERMISSOES.visualizarLeads,
    FASE3_PERMISSOES.criarLeads,
    FASE3_PERMISSOES.editarLeads,
    FASE3_PERMISSOES.visualizarPropostas,
    FASE3_PERMISSOES.criarPropostas,
    FASE3_PERMISSOES.editarPropostas,
  ],
  parceiro_imobiliaria: [], // legado intacto — sem perms Fase 3 novas
};
