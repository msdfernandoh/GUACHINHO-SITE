export type LeadStatus = string;

export const TIPOS_INTERESSE = [
  { value: "consorcio", label: "Consórcio" },
  { value: "financiamento", label: "Financiamento" },
  { value: "carta_contemplada", label: "Carta contemplada" },
  { value: "oportunidade_imobiliaria", label: "Oportunidade imobiliária" },
  { value: "credito_garantia", label: "Crédito com garantia" },
  { value: "outro", label: "Outro" },
] as const;

export const PRODUTOS_FECHADOS = [
  "Consórcio",
  "Financiamento",
  "Carta contemplada",
  "Crédito com garantia",
  "Imóvel",
  "Automóvel",
  "Caminhão/Carreta",
  "Outro",
] as const;

export const PROPOSTA_STATUS = [
  "Gerada",
  "Enviada",
  "Em negociação",
  "Aprovada",
  "Perdida",
  "Cancelada",
  "Arquivada",
] as const;

export const MODALIDADES_GRUPO = [
  "Imóvel",
  "Auto",
  "Moto",
  "Caminhonete",
  "Caminhão",
  "Carreta",
  "Serviços",
  "Outros",
] as const;

export const MODALIDADE_FILTRO_PUBLICO = ["Todos", "Imóvel", "Auto", "Moto"] as const;

export type GrupoConsorcio = {
  id: string;
  codigo_grupo: string;
  modalidade: string;
  administradora: string | null;
  taxa_administrativa_percentual: number | null;
  fundo_reserva_percentual: number | null;
  seguro_habilitado: boolean;
  seguro_percentual: number | null;
  seguro_valor: number | null;
  tem_parcela_reduzida: boolean;
  percentual_parcela_reduzida: number | null;
  permite_lance_embutido: boolean;
  percentual_lance_embutido: number | null;
  percentual_recurso_proprio_sugerido: number | null;
  prazo_total: number | null;
  parcelas_realizadas: number | null;
  prazo_restante: number | null;
  seguro_pos_contemplacao: boolean;
  cet_percentual: number | null;
  status: string;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type GrupoCota = {
  id: string;
  grupo_id: string;
  valor_credito: number;
  valor_parcela: number | null;
  parcela_integral: number | null;
  parcela_reduzida: number | null;
  parcela_com_seguro: number | null;
  parcela_sem_seguro: number | null;
  saldo_devedor: number | null;
  vagas_percentual: number | null;
  vagas_texto: string | null;
  status: string;
  ativo: boolean;
  ordem: number;
};

export type CotaComGrupo = GrupoCota & {
  grupo: GrupoConsorcio;
};
