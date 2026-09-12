export const OPCOES_VEICULO = [
  { id: "carro", label: "Carro", emoji: "🚗" },
  { id: "moto", label: "Moto", emoji: "🏍️" },
  { id: "carro_moto", label: "Carro e moto", emoji: "🚗🏍️" },
  { id: "nenhum", label: "Ainda não", emoji: "🚶" },
] as const;
export type VeiculoQualificacao = (typeof OPCOES_VEICULO)[number]["id"];

export const OPCOES_MORADIA = [
  { id: "propria_quitada", label: "Casa própria quitada", emoji: "🏠" },
  { id: "propria_financiada", label: "Casa própria financiada", emoji: "🏡" },
  { id: "aluguel", label: "Moro de aluguel", emoji: "🔑" },
  { id: "outra", label: "Outra situação", emoji: "✨" },
] as const;
export type MoradiaQualificacao = (typeof OPCOES_MORADIA)[number]["id"];

export const OPCOES_CAPACIDADE_MENSAL = [
  { id: "ate_500", label: "Até R$ 500" },
  { id: "500_1000", label: "R$ 500 a R$ 1.000" },
  { id: "1000_2000", label: "R$ 1.000 a R$ 2.000" },
  { id: "acima_2000", label: "Acima de R$ 2.000" },
  { id: "entender_primeiro", label: "Quero entender melhor primeiro" },
] as const;
export type CapacidadeMensalQualificacao = (typeof OPCOES_CAPACIDADE_MENSAL)[number]["id"];

export type QualificacaoRespostasPayload = {
  veiculo: VeiculoQualificacao;
  moradia: MoradiaQualificacao;
  capacidade_mensal: CapacidadeMensalQualificacao;
};

export type CheckinConversacionalResult =
  | {
      ok: true;
      jaCadastrado: boolean;
      nome: string;
      codigo: string;
      eventoNome?: string;
      checkinAt?: string;
    }
  | {
      ok: false;
      error: string;
    };

export function labelVeiculo(v: string | null | undefined): string {
  return OPCOES_VEICULO.find((o) => o.id === v)?.label ?? v ?? "Não informado";
}

export function labelMoradia(m: string | null | undefined): string {
  return OPCOES_MORADIA.find((o) => o.id === m)?.label ?? m ?? "Não informada";
}

export function labelCapacidade(c: string | null | undefined): string {
  return OPCOES_CAPACIDADE_MENSAL.find((o) => o.id === c)?.label ?? c ?? "Não informado";
}
