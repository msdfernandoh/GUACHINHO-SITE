const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Ex.: 1000000 → "R$ 1.000.000,00" */
export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return brlFormatter.format(value);
}

/**
 * Converte texto BRL ou dígitos para número em reais.
 * Aceita "R$ 1.000.000,00", "1000000,00", "1.000.000,00" ou sequência de dígitos (centavos).
 */
export function parseBRLMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutSymbol = trimmed.replace(/R\$\s?/gi, "").trim();
  if (/[,.]/.test(withoutSymbol)) {
    const normalized = withoutSymbol.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  const cents = parseInt(digits, 10);
  if (!Number.isFinite(cents)) return null;
  return cents / 100;
}

/** Máscara enquanto digita (centavos → reais formatados). */
export function maskBRLMoneyInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const reais = parseInt(digits, 10) / 100;
  return formatBRL(reais);
}
