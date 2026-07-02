import type { EventoParticipanteRow, ParticipanteStatus } from "./types";

/** Vagas consumidas por inscrições confirmadas ou presentes. */
export const STATUS_OCUPA_VAGA: ParticipanteStatus[] = ["confirmado", "presente"];

export function quantidadeVagasInscricao(temAcompanhante: boolean): number {
  return temAcompanhante ? 2 : 1;
}

export function somarVagasUsadas(
  participantes: Pick<EventoParticipanteRow, "quantidade_vagas" | "status">[],
): number {
  return participantes
    .filter((p) => STATUS_OCUPA_VAGA.includes(p.status))
    .reduce((acc, p) => acc + (p.quantidade_vagas ?? 1), 0);
}

export function haVagaDisponivel(
  limite: number | null | undefined,
  vagasUsadas: number,
  vagasNecessarias: number,
): boolean {
  if (limite == null || limite <= 0) return true;
  return vagasUsadas + vagasNecessarias <= limite;
}

export function vagasRestantes(limite: number | null | undefined, vagasUsadas: number): number | null {
  if (limite == null || limite <= 0) return null;
  return Math.max(0, limite - vagasUsadas);
}
