/** Endereços já cadastrados e reutilizáveis em todos os materiais impressos. */
export function getEventoQrFixoPath(tipoCheckin?: string | null): string {
  return tipoCheckin === "externo" ? "/qr/externo" : "/qr/network";
}
