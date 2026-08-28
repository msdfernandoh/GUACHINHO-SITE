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
  "PDF gerado",
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

/** `value` bate com `grupos.modalidade` no banco; `label` é o texto na UI. */
export const MODALIDADE_FILTRO_PUBLICO = [
  { value: "Todos", label: "Todos" },
  { value: "Imóvel", label: "Imóvel" },
  { value: "Auto", label: "Veículo" },
  { value: "Moto", label: "Moto" },
] as const;

export type GrupoConsorcio = {
  id: string;
  codigo_grupo: string;
  modalidade: string;
  /** Categorias de publicação N:N. Um grupo pode aparecer em Auto e Moto sem duplicação. */
  categorias_publicacao?: Array<"Imóvel" | "Auto" | "Moto" | "Caminhão" | "Serviços" | "Outros" | string>;
  /** Snapshot/display legado (RACON/Racon). Não usar para autorização quando UUID existir. */
  administradora: string | null;
  /** FK estrutural → administradoras (preenchida a partir da E5). */
  administradora_id?: string | null;
  empresa_origem_id?: string | null;
  origem_governanca?: "LEGADO" | "LOCAL" | "GLOBAL";
  status_governanca?: "CONFIGURACAO_PENDENTE" | "PENDENTE_PLATFORM" | "LOCAL" | "GLOBAL";
  tipo_administradora_id?: string | null;
  modalidade_comissao_id?: string | null;
  taxa_administrativa_percentual: number | null;
  fundo_reserva_percentual: number | null;
  seguro_habilitado: boolean;
  seguro_percentual: number | null;
  seguro_valor: number | null;
  tem_parcela_reduzida: boolean;
  /** Pode ser restringida pela franquia, sem alterar o catálogo global. */
  permite_parcela_integral?: boolean;
  percentual_parcela_reduzida: number | null;
  /** Regra informativa para novos grupos; grupos legados permanecem sem valor. */
  regra_integralizacao_parcela_reduzida?: "CONTEMPLACAO" | "ASSEMBLEIA" | null;
  /** Última assembleia reduzida. A parcela integral começa em X+1. */
  assembleia_limite_parcela_reduzida?: number | null;
  data_primeira_assembleia?: string | null;
  permite_parcela_reduzida_personalizada?: boolean;
  percentual_parcela_reduzida_personalizada?: number | null;
  permite_lance_embutido: boolean;
  percentual_lance_embutido: number | null;
  percentual_recurso_proprio_sugerido: number | null;
  prazo_total: number | null;
  parcelas_realizadas: number | null;
  prazo_restante: number | null;
  parcelas_realizadas_base?: number | null;
  data_base_parcelas?: string | null;
  atualizacao_parcelas_automatica?: boolean | null;
  /** Último marco 12/24/36… em que o crédito foi reajustado (remove destaque na lista). */
  credito_reajustado_ate_meses?: number | null;
  seguro_pos_contemplacao: boolean;
  cet_percentual: number | null;
  status: string;
  ativo: boolean;
  capacidade_total?: number | null;
  vagas_disponiveis?: number | null;
  vagas_atualizado_em?: string | null;
  aguardando_novas_vagas?: boolean;
  alteracao_catalogo_status?: string | null;
  observacoes: string | null;
  quantidade_cotas_sorteio?: number | null;
  created_at: string;
  updated_at: string;
};

export type GrupoSorteioLoteria = {
  id: string;
  grupo_id: string;
  periodo_ref: string;
  ano: number;
  mes: number;
  primeiro_premio: string;
  quantidade_cotas: number;
  palavra_chave: number;
  data_sorteio: string | null;
  fonte_resultado: string | null;
  resultado_buscado_automaticamente: boolean;
  observacao: string | null;
  criado_por_usuario_id: string | null;
  criado_por_nome: string | null;
  criado_por_email: string | null;
  created_at: string;
  updated_at: string;
};

export type GrupoSorteioLoteriaRow = GrupoSorteioLoteria & {
  grupo?: Pick<GrupoConsorcio, "id" | "codigo_grupo" | "modalidade">;
};

export type GrupoModalidadeLance = {
  id: string;
  grupo_id: string;
  nome: string;
  percentual_lance_embutido: number;
  percentual_recurso_proprio_minimo: number;
  base_referencia?: "SALDO_DEVEDOR" | "CREDITO";
  descricao: string | null;
  ativo: boolean;
  ordem: number;
  tipo_parcela?: "integral" | "reduzida" | null;
  percentual_parcela_reduzida?: number | null;
  created_at: string;
  updated_at: string;
};

export type PublicGrupoAggregate = {
  grupo: GrupoConsorcio;
  cotas: GrupoCota[];
  modalidades: GrupoModalidadeLance[];
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
