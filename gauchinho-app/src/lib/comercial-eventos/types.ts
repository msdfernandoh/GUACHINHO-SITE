export const PARTICIPANTE_STATUS = [
  "confirmado",
  "cancelado",
  "presente",
  "ausente",
  "lista_espera",
] as const;

export type ParticipanteStatus = (typeof PARTICIPANTE_STATUS)[number];

export type EventoRow = {
  id: string;
  nome: string;
  slug: string;
  descricao_curta: string | null;
  descricao: string | null;
  data_evento: string | null;
  local: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  imagem_capa_url: string | null;
  banner_url: string | null;
  ativo: boolean;
  publicado: boolean;
  somente_por_link: boolean;
  evento_destaque: boolean;
  limite_participantes: number | null;
  permitir_acompanhante: boolean;
  exigir_convidou: boolean;
  mostrar_vagas: boolean;
  mensagem_confirmacao: string | null;
  observacoes_internas: string | null;
  created_at: string;
  updated_at: string;
};

export type EventoParticipanteRow = {
  id: string;
  evento_id: string;
  lead_id: string | null;
  nome_participante: string;
  telefone_participante: string;
  nome_acompanhante: string | null;
  telefone_acompanhante: string | null;
  tem_acompanhante: boolean;
  nome_convidou: string | null;
  empresa_convidou: string | null;
  observacao: string | null;
  quantidade_vagas: number;
  status: ParticipanteStatus;
  checkin_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EventoPostRow = {
  id: string;
  evento_id: string;
  titulo: string | null;
  conteudo: string | null;
  imagem_url: string | null;
  ordem: number;
  publicado: boolean;
  created_at: string;
  updated_at: string;
};

export type InscricaoEventoPayload = {
  nomeParticipante: string;
  telefoneParticipante: string;
  temAcompanhante?: boolean;
  nomeAcompanhante?: string;
  telefoneAcompanhante?: string;
  nomeConvidou?: string;
  empresaConvidou?: string;
  observacao?: string;
};

export type InscricaoEventoResult =
  | { ok: true; status: "confirmado"; mensagem: string }
  | { ok: true; status: "lista_espera"; mensagem: string };
