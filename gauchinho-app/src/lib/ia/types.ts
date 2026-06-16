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
  valorAproximado?: number;
  urgencia?: string;
  recursoProprio?: number;
  resumo?: string;
};

export type ExtrairLeadResult = {
  dados: DadosLeadExtraidos;
  prontoParaLead: boolean;
};
