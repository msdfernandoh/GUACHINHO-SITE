export function formatProtocoloFromSequence(seq: number): string {
  const n = Math.max(1, Math.floor(seq));
  return `GCH-CTR-${String(n).padStart(6, "0")}`;
}

export function parseProtocoloNumber(protocolo: string): number | null {
  const m = /^GCH-CTR-(\d+)$/i.exec(protocolo.trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}
