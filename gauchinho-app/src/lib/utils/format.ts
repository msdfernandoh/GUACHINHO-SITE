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

/** Apenas dígitos (útil para telefone). */
export function digitsOnlyPhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** Máscara BR celular: (DD) 9XXXX-XXXX ou fixo (DD) XXXX-XXXX */
export function formatWhatsappBrInput(raw: string): string {
  const d = digitsOnlyPhone(raw).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function parseBulkCreditLines(text: string): number[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseBrazilianNumber(line))
    .filter((n) => n > 0);
}
