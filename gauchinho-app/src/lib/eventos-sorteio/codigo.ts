const CODIGO_RE = /(?:[A-Za-z0-9]+-)?(\d+)$/i;

/** Formata sequência numérica (default: '001', '027' ou com prefixo opcional 'RCN-001'). */
export function formatCodigoParticipacao(
  sequencia: number,
  prefixo: string = "",
  digitos: number = 3,
): string {
  if (!Number.isFinite(sequencia) || sequencia < 1) {
    throw new Error("Sequência de código inválida");
  }
  const numPad = String(Math.floor(sequencia)).padStart(digitos, "0");
  return prefixo ? `${prefixo}${numPad}` : numPad;
}

export function parseCodigoSequencia(codigo: string): number | null {
  const m = CODIGO_RE.exec(codigo.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Próximo código a partir da lista de códigos já usados no evento. */
export function proximoCodigoFromExisting(
  codigos: string[],
  prefixo: string = "",
  digitos: number = 3,
): string {
  let max = 0;
  for (const c of codigos) {
    const n = parseCodigoSequencia(c);
    if (n != null && n > max) max = n;
  }
  return formatCodigoParticipacao(max + 1, prefixo, digitos);
}
