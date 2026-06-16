export type IndiceCodigo =
  | "ipca"
  | "igpm"
  | "cdi"
  | "selic"
  | "poupanca"
  | "tesouro_selic"
  | "tesouro_ipca"
  | "taxa_manual";

export type IndiceFinanceiroRow = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  valor_mensal: number | null;
  valor_anual: number | null;
  valor_acumulado_12m: number | null;
  fonte: string | null;
  fonte_url: string | null;
  data_referencia: string | null;
  ultima_atualizacao: string | null;
  ativo: boolean;
  atualizacao_automatica: boolean;
  fallback_manual: boolean;
  observacao: string | null;
};

export type IndicePublico = {
  codigo: IndiceCodigo;
  nome: string;
  valor_mensal: number | null;
  valor_anual: number | null;
  valor_acumulado_12m: number | null;
  data_referencia: string | null;
  ultima_atualizacao: string | null;
  fonte: string | null;
  usando_fallback: boolean;
  atualizacao_automatica: boolean;
};

export type IndiceRefreshResult = {
  codigo: string;
  ok: boolean;
  message?: string;
};
