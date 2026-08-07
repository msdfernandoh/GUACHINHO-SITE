import type {
  OrganizacaoStatus,
  OrganizacaoTipo,
  ParticipanteStatus,
  ParticipanteTipoCodigo,
} from "./constants";

export type ParticipanteComercial = {
  id: string;
  empresa_id: string;
  usuario_id: string | null;
  nome: string;
  nome_exibicao: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cargo: string | null;
  status: ParticipanteStatus;
  gestor_participante_id: string | null;
  data_entrada: string | null;
  data_saida: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by_usuario_id: string | null;
};

export type ParticipanteComTipos = ParticipanteComercial & {
  tipos: ParticipanteTipoCodigo[];
};

export type OrganizacaoParceira = {
  id: string;
  empresa_id: string;
  tipo: OrganizacaoTipo;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  status: OrganizacaoStatus;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  instagram: string | null;
  descricao: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  endereco: string | null;
  regioes_atuacao: unknown;
  logo_url: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by_usuario_id: string | null;
};

export type ParticipanteOrganizacaoVinculo = {
  id: string;
  empresa_id: string;
  participante_id: string;
  organizacao_parceira_id: string;
  funcao: string | null;
  principal: boolean;
  responsavel_principal: boolean;
  ativo: boolean;
  inicio_vigencia: string | null;
  fim_vigencia: string | null;
};

export type ParceiroSite = {
  id: string;
  empresa_id: string;
  organizacao_parceira_id: string;
  slug: string;
  template_codigo: string;
  status_publicacao: string;
  canal_principal: string;
  nome_site: string;
  descricao: string;
  branding: Record<string, unknown>;
  menus: unknown;
  whatsapp_modo: string;
  whatsapp: string | null;
  seo: Record<string, unknown>;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  created_by_usuario_id: string | null;
};

export type ParceiroSiteDominio = {
  id: string;
  empresa_id: string;
  parceiro_site_id: string;
  valor: string;
  tipo: string;
  principal: boolean;
  verificado: boolean;
  status: string;
  ssl_status: string;
  dns_instrucoes: Record<string, unknown>;
  ultima_verificacao_em: string | null;
  ultima_mensagem_erro: string | null;
  vercel_domain_id: string | null;
  vercel_project_id: string | null;
  canonical_redirect: boolean;
  created_at: string;
  updated_at: string;
};

export type ParceiroSiteListRow = ParceiroSite & {
  organizacao_nome?: string | null;
  dominio_principal?: string | null;
  dominio_status?: string | null;
  dominio_ssl?: string | null;
};
