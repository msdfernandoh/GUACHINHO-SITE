const CODIGO_RE = /^GCH-(\d+)$/i;

/** Formata sequência numérica no padrão GCH-0001. */
export function formatCodigoParticipacao(sequencia: number): string {
  if (!Number.isFinite(sequencia) || sequencia < 1) {
    throw new Error("Sequência de código inválida");
  }
  return `GCH-${String(Math.floor(sequencia)).padStart(4, "0")}`;
}

export function parseCodigoSequencia(codigo: string): number | null {
  const m = CODIGO_RE.exec(codigo.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Próximo código a partir da lista de códigos já usados no evento. */
export function proximoCodigoFromExisting(codigos: string[]): string {
  let max = 0;
  for (const c of codigos) {
    const n = parseCodigoSequencia(c);
    if (n != null && n > max) max = n;
  }
  return formatCodigoParticipacao(max + 1);
}
