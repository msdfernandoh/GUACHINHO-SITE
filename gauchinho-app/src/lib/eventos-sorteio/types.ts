import type { NpsPerguntaPublica } from "./nps";

export const TIPOS_SONHO_SORTEIO = ["Moto", "Carro", "Casa", "Terreno", "Frota"] as const;
export type TipoSonhoSorteio = (typeof TIPOS_SONHO_SORTEIO)[number];

export const SORTEIO_STATUS = ["aberto", "encerrado"] as const;
export type SorteioStatus = (typeof SORTEIO_STATUS)[number];

export const PARTICIPANTE_STATUS = ["participando", "cancelado"] as const;
export type ParticipanteStatus = (typeof PARTICIPANTE_STATUS)[number];

export const FASES_CADASTRO = ["fase1", "fase2", "fase3", "completo"] as const;
export type FaseCadastro = (typeof FASES_CADASTRO)[number];

export const ORIGENS_CUPOM = ["cadastro", "indicacao"] as const;
export type OrigemCupom = (typeof ORIGENS_CUPOM)[number];

export const TIPOS_INDICACAO = ["amigo", "familiar"] as const;
export type TipoIndicacao = (typeof TIPOS_INDICACAO)[number];

export type EventoSorteioRow = {
  id: string;
  evento_id: string;
  ativo: boolean;
  titulo: string | null;
  descricao: string | null;
  texto_agradecimento: string | null;
  quantidade_brindes: number;
  mostrar_home: boolean;
  permitir_telefone_duplicado: boolean;
  status: SorteioStatus;
  nps_config?: unknown;
  created_at: string;
  updated_at: string;
};

export type SorteioParticipanteRow = {
  id: string;
  sorteio_id: string;
  evento_id: string;
  evento_participante_id?: string | null;
  lead_id: string | null;
  codigo: string;
  nome: string;
  telefone: string;
  valor_mensal_disponivel: number | null;
  tipo_sonho: string | null;
  quem_convidou: string | null;
  observacao: string | null;
  status: ParticipanteStatus;
  ganhador: boolean;
  sorteado_em: string | null;
  fase_cadastro?: FaseCadastro;
  origem_cupom?: OrigemCupom;
  participante_principal_id?: string | null;
  nps_respostas?: Record<string, unknown> | null;
  nps_completo_em?: string | null;
  indicacoes_concluido_em?: string | null;
  qr_code_unico_id?: string | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULTS_SORTEIO = {
  titulo: "Participe do sorteio de brindes do Gauchinho",
  descricao:
    "Cadastre-se, participe das oportunidades do evento e receba seu código para concorrer aos brindes.",
  texto_agradecimento: "Obrigado por participar! Guarde seu código para acompanhar o sorteio.",
} as const;

export type PublicSorteioView = {
  sorteioId: string;
  eventoId: string;
  eventoNome: string;
  eventoSlug: string;
  eventoData: string | null;
  titulo: string;
  descricao: string;
  textoAgradecimento: string;
  status: SorteioStatus;
  npsPerguntas: NpsPerguntaPublica[];
};

export type HomeSorteioDestaque = {
  eventoNome: string;
  eventoSlug: string;
  titulo: string;
};
