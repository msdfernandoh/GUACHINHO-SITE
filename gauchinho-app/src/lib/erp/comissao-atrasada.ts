/** A marca operacional não altera liquidação, elegibilidade ou pagamento. */
export function lerComissaoAtrasada(snapshot: unknown, saldo: number): string | null {
  if (saldo <= 0.009 || !snapshot || typeof snapshot !== "object") return null;
  const marca = (snapshot as Record<string, unknown>).acompanhamento_inadimplencia;
  if (!marca || typeof marca !== "object") return null;
  const registro = marca as Record<string, unknown>;
  if (registro.situacao !== "ATRASADA") return null;
  return typeof registro.motivo === "string" ? registro.motivo : "Comissão atrasada em acompanhamento.";
}
