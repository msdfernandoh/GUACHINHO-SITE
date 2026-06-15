export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export function formatDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  if (!date) return "—";
  const base = formatDate(date);
  if (!time) return base;
  return `${base} ${time.slice(0, 5)}`;
}

export function parseBrazilianNumber(raw: string): number {
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseBulkCreditLines(text: string): number[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseBrazilianNumber(line))
    .filter((n) => n > 0);
}
