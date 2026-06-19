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
  temperatura: string | null;
  srd_responsavel_id: string | null;
  srd_responsavel_nome: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  proximo_retorno_data: string | null;
  ultima_interacao_at: string | null;
  valor_estimado: number | null;
  valor_simulado: number | null;
  fechado: boolean;
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
  srd?: string;
  retorno?: string;
  q?: string;
  temperatura?: string;
  produto?: string;
  cidade?: string;
  sem_responsavel?: string;
  somente_novos?: string;
  somente_quentes?: string;
  acao_vencida?: string;
};
