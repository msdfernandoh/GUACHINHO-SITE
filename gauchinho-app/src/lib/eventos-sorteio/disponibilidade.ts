import { formatarDataHoraEvento, formatarHoraEvento } from "./timezone";

export type CheckinModo = "agendado" | "ativo_agora" | "encerrado";

export type CheckinStatus = "agendado" | "aberto" | "ativo_manual" | "encerrado" | "desativado";

export type CheckinDisponibilidadeInfo = {
  status: CheckinStatus;
  aberto: boolean;
  horarioAberturaIso: string | null;
  horarioAberturaFormatado: string | null;
  horarioEventoFormatado: string | null;
  mensagemAmigavel: string;
};

export type EventoDisponibilidadeInput = {
  ativo: boolean;
  checkin_interativo_ativo?: boolean | null;
  data_evento?: string | null;
  checkin_modo?: string | null;
  checkin_abertura_antecipada_minutos?: number | null;
};

/**
 * Resolve centralizadamente o status de disponibilidade do check-in de um evento.
 * Consumido de forma unificada no Painel Admin, Modal de QR, Tela Pública e QR Permanente.
 *
 * @param evento Dados do evento relevantes para a disponibilidade
 * @param agoraDate Instante de referência para avaliação (permite mock em testes sem relógio instável)
 */
export function resolverStatusCheckinEvento(
  evento: EventoDisponibilidadeInput,
  agoraDate: Date = new Date(),
): CheckinDisponibilidadeInfo {
  // Se o evento estiver inativo ou check-in interativo desativado
  if (!evento.ativo || evento.checkin_interativo_ativo === false) {
    return {
      status: "desativado",
      aberto: false,
      horarioAberturaIso: null,
      horarioAberturaFormatado: null,
      horarioEventoFormatado: evento.data_evento ? formatarDataHoraEvento(evento.data_evento) : null,
      mensagemAmigavel: "Check-in interativo não está habilitado para este evento.",
    };
  }

  const modo: CheckinModo = (evento.checkin_modo as CheckinModo) || "agendado";
  const horarioEventoFormatado = evento.data_evento ? formatarDataHoraEvento(evento.data_evento) : null;

  // 1. Modo Manual: Ativado Agora (liberado imediatamente para ensaio/teste real)
  if (modo === "ativo_agora") {
    return {
      status: "ativo_manual",
      aberto: true,
      horarioAberturaIso: null,
      horarioAberturaFormatado: null,
      horarioEventoFormatado,
      mensagemAmigavel: "Check-in liberado manualmente pelo organizador.",
    };
  }

  // 2. Modo Manual: Encerrado
  if (modo === "encerrado") {
    return {
      status: "encerrado",
      aberto: false,
      horarioAberturaIso: null,
      horarioAberturaFormatado: null,
      horarioEventoFormatado,
      mensagemAmigavel: "O check-in para este evento já foi encerrado.",
    };
  }

  // 3. Modo Agendado (Padrão)
  if (!evento.data_evento) {
    // Se não há data estipulada, deixa aberto
    return {
      status: "aberto",
      aberto: true,
      horarioAberturaIso: null,
      horarioAberturaFormatado: null,
      horarioEventoFormatado: null,
      mensagemAmigavel: "Check-in disponível.",
    };
  }

  const dataEventoDate = new Date(evento.data_evento);
  if (Number.isNaN(dataEventoDate.getTime())) {
    return {
      status: "aberto",
      aberto: true,
      horarioAberturaIso: null,
      horarioAberturaFormatado: null,
      horarioEventoFormatado: null,
      mensagemAmigavel: "Check-in disponível.",
    };
  }

  const antecedenciaMinutos =
    typeof evento.checkin_abertura_antecipada_minutos === "number" &&
    evento.checkin_abertura_antecipada_minutos >= 0
      ? evento.checkin_abertura_antecipada_minutos
      : 30;

  const aberturaMs = dataEventoDate.getTime() - antecedenciaMinutos * 60 * 1000;
  const aberturaDate = new Date(aberturaMs);
  const horarioAberturaIso = aberturaDate.toISOString();
  const horarioAberturaFormatado = formatarHoraEvento(horarioAberturaIso);

  const agoraMs = agoraDate.getTime();

  if (agoraMs < aberturaMs) {
    const dataFormatada = formatarDataHoraEvento(evento.data_evento);
    const avisoAbertura =
      antecedenciaMinutos > 0
        ? ` O check-in será liberado a partir das ${horarioAberturaFormatado}.`
        : ` O check-in será liberado no horário do evento.`;

    return {
      status: "agendado",
      aberto: false,
      horarioAberturaIso,
      horarioAberturaFormatado,
      horarioEventoFormatado,
      mensagemAmigavel: `Este evento está confirmado para ${dataFormatada}.${avisoAbertura}`,
    };
  }

  // Passou do horário de abertura
  return {
    status: "aberto",
    aberto: true,
    horarioAberturaIso,
    horarioAberturaFormatado,
    horarioEventoFormatado,
    mensagemAmigavel: "Check-in aberto.",
  };
}
