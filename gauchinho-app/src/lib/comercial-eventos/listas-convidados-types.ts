export const LISTA_CONVIDADO_STATUS = ["pendente", "confirmado", "cancelado", "presente"] as const;
export type ListaConvidadoStatus = (typeof LISTA_CONVIDADO_STATUS)[number];

export const LISTA_CONVIDADO_RESULTADO = ["ganho", "sem_interesse", "futuro"] as const;
export type ListaConvidadoResultado = (typeof LISTA_CONVIDADO_RESULTADO)[number];

export type EventoListaConvidadosRow = {
  id: string;
  evento_id: string;
  consultor_nome: string;
  consultor_usuario_id: string | null;
  criado_por_usuario_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EventoListaConvidadosItemRow = {
  id: string;
  lista_id: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  convidado_por: string | null;
  status_presenca: ListaConvidadoStatus;
  resultado: ListaConvidadoResultado | null;
  valor: number | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type ListaConvidadosResumo = EventoListaConvidadosRow & {
  evento_nome: string;
  total: number;
  confirmados: number;
  presentes: number;
  cancelados: number;
};

export type GuestDraft = {
  nome: string;
  empresa: string;
  telefone: string;
  convidado_por: string;
};

export const LISTA_STATUS_LABEL: Record<ListaConvidadoStatus, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  presente: "Presente",
};

export const LISTA_RESULTADO_LABEL: Record<ListaConvidadoResultado, string> = {
  ganho: "Ganho",
  sem_interesse: "Sem interesse",
  futuro: "Futuro",
};
