export const TIPOS_SONHO_SORTEIO = ["Moto", "Carro", "Casa", "Terreno", "Frota"] as const;
export type TipoSonhoSorteio = (typeof TIPOS_SONHO_SORTEIO)[number];

export const SORTEIO_STATUS = ["aberto", "encerrado"] as const;
export type SorteioStatus = (typeof SORTEIO_STATUS)[number];

export const PARTICIPANTE_STATUS = ["participando", "cancelado"] as const;
export type ParticipanteStatus = (typeof PARTICIPANTE_STATUS)[number];

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
  created_at: string;
  updated_at: string;
};

export type SorteioParticipanteRow = {
  id: string;
  sorteio_id: string;
  evento_id: string;
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
};

export type HomeSorteioDestaque = {
  eventoNome: string;
  eventoSlug: string;
  titulo: string;
};
