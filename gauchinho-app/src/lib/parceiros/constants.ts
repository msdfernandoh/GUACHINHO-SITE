/** Feature flags Fase 3 — todas false por padrão. */
export const FASE3_ADMIN_PARTICIPANTES_ENABLED =
  process.env.FASE3_ADMIN_PARTICIPANTES_ENABLED === "true";
export const FASE3_PARCEIRO_SITES_ADMIN_ENABLED =
  process.env.FASE3_PARCEIRO_SITES_ADMIN_ENABLED === "true";
/** Futura: rota pública /parceiro/[slug] e hosts. */
export const FASE3_PARCEIRO_PUBLIC_SITE_ENABLED =
  process.env.FASE3_PARCEIRO_PUBLIC_SITE_ENABLED === "true";
/** Futura: área comercial do parceiro. */
export const FASE3_PARCEIRO_AREA_ENABLED =
  process.env.FASE3_PARCEIRO_AREA_ENABLED === "true";
/** E5: mutações reais na API Vercel Domains (server-side). Default false. */
export const FASE3_VERCEL_DOMAINS_ENABLED =
  process.env.FASE3_VERCEL_DOMAINS_ENABLED === "true";

/** Projeto Vercel existente — não criar outro. Nome canônico (não secreto). */
export const VERCEL_PARCEIRO_PROJECT_NAME = "guachinho-site";
export const VERCEL_PARCEIRO_TEAM_SLUG = "hugo-8097s-projects";
/** ID documentado do projeto (não secreto). Override via VERCEL_PROJECT_ID. */
export const VERCEL_PARCEIRO_PROJECT_ID_DEFAULT = "prj_rcdKOewLz7V2FXEvmn3qHlyMiKMT";

/** Base oficial para subdomínio de parceiro no MVP (sem wildcard). */
export const PARCEIRO_SUBDOMAIN_BASE = "gauchinhoconsorcios.com.br";

/** Labels reservados sob a base do tenant — não podem ser slug de parceiro. */
export const PARCEIRO_SUBDOMAIN_LABELS_RESERVADOS = [
  "www",
  "admin",
  "api",
  "app",
  "auth",
  "login",
  "mail",
  "smtp",
  "ftp",
  "cdn",
  "static",
  "assets",
  "dashboard",
  "painel",
  "suporte",
  "status",
  "preview",
] as const;
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

export type ParceiroSiteStatus = (typeof PARCEIRO_SITE_STATUS)[number];

export const PARCEIRO_CANAIS = ["ROTA", "SUBDOMINIO", "DOMINIO"] as const;
export type ParceiroCanalPrincipal = (typeof PARCEIRO_CANAIS)[number];

export const PARCEIRO_DOMINIO_TIPOS = [
  "DOMINIO_PROPRIO",
  "SUBDOMINIO_EMPRESA",
  "ALIAS",
] as const;

export type ParceiroDominioTipo = (typeof PARCEIRO_DOMINIO_TIPOS)[number];

export const PARCEIRO_DOMINIO_STATUS = [
  "PENDENTE_DNS",
  "VERIFICANDO",
  "ATIVO",
  "ERRO",
  "SUSPENSO",
  "REMOVIDO",
] as const;

export const PARCEIRO_SSL_STATUS = ["PENDING", "READY", "ERROR"] as const;

export const WHATSAPP_MODOS = ["PROPRIO", "EMPRESA", "CONFIG"] as const;

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
  /** Explícita — não inferir por cargo/tipo sozinho no app (RLS também cobre RESPONSAVEL). */
  visaoAmpliadaOrg: "visao_ampliada_org_parceiro",
} as const;

/**
 * Status de proposta editáveis na área parceiro (equivalente conceitual a RASCUNHO).
 * Schema atual não possui literal `RASCUNHO`.
 */
export const PROPOSTA_STATUS_EDITAVEL_PARCEIRO = ["Gerada", "PDF gerado"] as const;

/** Status comerciais simples permitidos na área parceiro (Fase 6 amplia o funil). */
export const LEAD_STATUS_SIMPLES_PARCEIRO = [
  "Novo",
  "Em contato",
  "Qualificado",
  "Negociação",
  "Fechado",
  "Perdido",
] as const;

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
    // visao_ampliada_org_parceiro NÃO é concedida por padrão ao papel
  ],
  parceiro_imobiliaria: [], // legado intacto — sem perms Fase 3 novas
};
