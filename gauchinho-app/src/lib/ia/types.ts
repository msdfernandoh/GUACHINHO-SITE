export type IaChatRole = "user" | "assistant" | "system";

export type IaChatMessage = {
  role: IaChatRole;
  content: string;
};

export type DadosLeadExtraidos = {
  nome?: string;
  whatsapp?: string;
  cidade?: string;
  tipoInteresse?: string;
  produtoInteresse?: string;
  tipoCredito?: string;
  valorAproximado?: number;
  urgencia?: string;
  recursoProprio?: number;
  observacao?: string;
  resumo?: string;
};

export type ExtrairLeadResult = {
  dados: DadosLeadExtraidos;
  prontoParaLead: boolean;
};
