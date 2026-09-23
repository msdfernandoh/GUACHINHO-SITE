export type CrmFunilEtapaRow = {
  id: string;
  empresa_id: string;
  nome: string;
  slug: string;
  ordem: number;
  cor: string;
  is_won: boolean;
  is_lost: boolean;
  is_standby: boolean;
  is_ativo: boolean;
  created_at?: string;
};

export type LeadArquivoRow = {
  id: string;
  empresa_id: string;
  lead_id: string;
  arquivo_url: string;
  arquivo_nome: string;
  arquivo_tamanho: number | null;
  mime_type: string | null;
  criado_por_usuario_id: string | null;
  created_at: string;
};

export type LeadListRow = {
  id: string;
  created_at: string;
  nome: string;
  whatsapp: string | null;
  email?: string | null;
  cidade: string | null;
  origem: string | null;
  tipo_interesse: string | null;
  produto_interesse: string | null;
  status: string;
  etapa_id?: string | null;
  etapa_slug?: string | null;
  etapa_nome?: string | null;
  etapa_cor?: string | null;
  is_incompleto?: boolean | null;
  modelo_interesse?: string | null;
  data_ultimo_contato?: string | null;
  motivo_perda_codigo?: string | null;
  temperatura: string | null;
  srd_responsavel_id: string | null;
  srd_responsavel_nome: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  proximo_retorno_data: string | null;
  ultima_interacao_at: string | null;
  valor_estimado: number | null;
  valor_credito?: number | null;
  valor_simulado: number | null;
  valor_parcela?: number | null;
  valor_fechado?: number | null;
  valor_parcela_fechamento?: number | null;
  dados_simulacao?: unknown;
  fechado: boolean;
  evento_id?: string | null;
  evento_nome?: string | null;
  parceiro_indicador_nome?: string | null;
  parceiro_indicador_empresa?: string | null;
  parceiro_indicador_telefone?: string | null;
  parentesco_indicacao?: string | null;
  indicador_lead_id?: string | null;
  /** Carro, Moto, Casa… — cadastro do sorteio/evento */
  tipo_sonho?: string | null;
  historico_cadastros?: string | null;
  observacoes?: string | null;
  tags?: string[] | null;
};

export type IndicacaoRapidaItem = {
  nome: string;
  whatsapp: string;
  /** Casa, Carro, Moto… */
  tipoSonho?: string | null;
  /** amigo, familiar, etc. */
  parentesco?: string | null;
};

export type LeadAtividade = {
  id: string;
  lead_id: string;
  usuario_id: string | null;
  tipo: string;
  titulo: string | null;
  descricao: string | null;
  status: string;
  data_agendada: string | null;
  data_conclusao: string | null;
  created_at: string;
  updated_at: string;
};

export type TimelineItem = {
  id: string;
  at: string;
  tipo: string;
  titulo: string;
  descricao?: string | null;
  origem: "historico" | "evento" | "atividade";
};

export type LeadFilters = {
  periodo?: string;
  origem?: string;
  status?: string;
  etapa_id?: string;
  srd?: string;
  retorno?: string;
  q?: string;
  temperatura?: string;
  produto?: string;
  cidade?: string;
  sem_responsavel?: string;
  somente_novos?: string;
  somente_quentes?: string;
  somente_incompletos?: string;
  parados_dias?: string;
  acao_vencida?: string;
  evento?: string;
  modelo_interesse?: string;
  etapa?: string;
  fase?: string;
  etapa_slug?: string;
};
