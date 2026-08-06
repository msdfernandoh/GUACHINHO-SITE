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
