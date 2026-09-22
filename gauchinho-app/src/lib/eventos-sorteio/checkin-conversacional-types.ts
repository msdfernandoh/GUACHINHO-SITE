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

export const OPCOES_AVALIACAO_ENCONTRO = [
  { id: "gostei_bastante", label: "Gostei bastante e fez sentido para mim" },
  { id: "gostei_entender_melhor", label: "Gostei, mas ainda quero entender melhor alguns pontos" },
  { id: "pode_melhorar", label: "Acho que pode melhorar" },
] as const;
export type AvaliacaoEncontro = (typeof OPCOES_AVALIACAO_ENCONTRO)[number]["id"];

export const OPCOES_MOMENTO_OPORTUNIDADE = [
  { id: "simulacao_agora", label: "Quero fazer uma simulação agora, de acordo com meus objetivos e necessidades" },
  { id: "atendimento_presencial", label: "Quero agendar um atendimento presencial para os próximos dias" },
  { id: "retomar_ate_3_meses", label: "Tenho interesse, mas pretendo retomar esse objetivo em até 3 meses" },
  { id: "futuro_acima_3_meses", label: "Tenho interesse para o futuro, acima de 3 meses" },
  { id: "sem_interesse", label: "Neste momento, não tenho interesse" },
] as const;
export type MomentoOportunidade = (typeof OPCOES_MOMENTO_OPORTUNIDADE)[number]["id"];

export type QualificacaoRespostasPayload = {
  veiculo: VeiculoQualificacao;
  moradia: MoradiaQualificacao;
  capacidade_mensal: CapacidadeMensalQualificacao;
  avaliacao_encontro: AvaliacaoEncontro;
  avaliacao_melhoria?: string | null;
  momento_oportunidade: MomentoOportunidade;
};

export type QualificacaoValidationResult =
  | { ok: true; value: QualificacaoRespostasPayload }
  | { ok: false; error: string };

export function validarQualificacaoRespostas(input: unknown): QualificacaoValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Responda todas as perguntas para concluir." };
  }

  const raw = input as Record<string, unknown>;
  const veiculo = String(raw.veiculo ?? "");
  const moradia = String(raw.moradia ?? "");
  const capacidade = String(raw.capacidade_mensal ?? "");
  const avaliacao = String(raw.avaliacao_encontro ?? "");
  const momento = String(raw.momento_oportunidade ?? "");
  const melhoria = String(raw.avaliacao_melhoria ?? "").trim();

  if (!OPCOES_VEICULO.some((opcao) => opcao.id === veiculo)) {
    return { ok: false, error: "Selecione uma opção válida sobre veículo." };
  }
  if (!OPCOES_MORADIA.some((opcao) => opcao.id === moradia)) {
    return { ok: false, error: "Selecione uma opção válida sobre moradia." };
  }
  if (!OPCOES_CAPACIDADE_MENSAL.some((opcao) => opcao.id === capacidade)) {
    return { ok: false, error: "Selecione uma faixa de investimento válida." };
  }
  if (!OPCOES_AVALIACAO_ENCONTRO.some((opcao) => opcao.id === avaliacao)) {
    return { ok: false, error: "Avalie o conteúdo e as oportunidades do encontro." };
  }
  if (avaliacao === "pode_melhorar" && melhoria.length < 3) {
    return { ok: false, error: "Conte brevemente o que poderíamos fazer melhor." };
  }
  if (melhoria.length > 1000) {
    return { ok: false, error: "O comentário de melhoria deve ter no máximo 1.000 caracteres." };
  }
  if (!OPCOES_MOMENTO_OPORTUNIDADE.some((opcao) => opcao.id === momento)) {
    return { ok: false, error: "Selecione a opção que mais combina com o seu momento atual." };
  }

  return {
    ok: true,
    value: {
      veiculo: veiculo as VeiculoQualificacao,
      moradia: moradia as MoradiaQualificacao,
      capacidade_mensal: capacidade as CapacidadeMensalQualificacao,
      avaliacao_encontro: avaliacao as AvaliacaoEncontro,
      avaliacao_melhoria: avaliacao === "pode_melhorar" ? melhoria : null,
      momento_oportunidade: momento as MomentoOportunidade,
    },
  };
}

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

export function labelAvaliacaoEncontro(a: string | null | undefined): string {
  return OPCOES_AVALIACAO_ENCONTRO.find((o) => o.id === a)?.label ?? a ?? "Não informada";
}

export function labelMomentoOportunidade(m: string | null | undefined): string {
  return OPCOES_MOMENTO_OPORTUNIDADE.find((o) => o.id === m)?.label ?? m ?? "Não informado";
}
