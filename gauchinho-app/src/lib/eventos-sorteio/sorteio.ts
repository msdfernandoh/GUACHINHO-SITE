import { normalizeTelefoneSorteio } from "./vagas";
import type { SorteioParticipanteRow } from "./types";

export type ParticipanteElegivel = Pick<
  SorteioParticipanteRow,
  "id" | "codigo" | "nome" | "telefone" | "status" | "ganhador"
>;

/** Participantes aptos ao sorteio (não ganhadores anteriores, status participando). */
export function filtrarElegiveisSorteio(participantes: ParticipanteElegivel[]): ParticipanteElegivel[] {
  return participantes.filter((p) => p.status === "participando" && !p.ganhador);
}

/** Ids de todos os cupons do mesmo telefone (chave de “ganha só uma vez”). */
export function idsCuponsMesmoTelefone(
  participantes: ParticipanteElegivel[],
  telefone: string,
): string[] {
  const norm = normalizeTelefoneSorteio(telefone);
  return participantes
    .filter((p) => normalizeTelefoneSorteio(p.telefone) === norm)
    .map((p) => p.id);
}

/** Escolhe um participante aleatório entre os elegíveis, excluindo ids já sorteados na sessão. */
export function escolherParticipanteAleatorio(
  participantes: ParticipanteElegivel[],
  excludeIds: ReadonlySet<string> = new Set(),
  random: () => number = Math.random,
): ParticipanteElegivel | null {
  const pool = filtrarElegiveisSorteio(participantes).filter((p) => !excludeIds.has(p.id));
  if (pool.length === 0) return null;
  const idx = Math.floor(random() * pool.length);
  return pool[idx] ?? null;
}

/** Códigos para animação de giro (lista de elegíveis ou fallback). */
export function codigosParaAnimacao(
  participantes: ParticipanteElegivel[],
  vencedorCodigo: string,
  ticks = 24,
): string[] {
  const elegiveis = filtrarElegiveisSorteio(participantes);
  const fonte = elegiveis.length > 0 ? elegiveis.map((p) => p.codigo) : [vencedorCodigo];
  const seq: string[] = [];
  for (let i = 0; i < ticks; i++) {
    seq.push(fonte[i % fonte.length]!);
  }
  seq.push(vencedorCodigo);
  return seq;
}
