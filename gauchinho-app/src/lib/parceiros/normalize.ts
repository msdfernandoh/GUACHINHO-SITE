import { normalizeHost, validateHostForPersist } from "@/lib/tenant/dominio";

export function normalizeDigits(value: string | null | undefined): string | null {
  if (value == null) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = value.trim().toLowerCase();
  return v || null;
}

export function normalizeSlug(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return v || null;
}

export function normalizeCpf(value: string | null | undefined): string | null {
  const digits = normalizeDigits(value);
  if (!digits) return null;
  if (digits.length !== 11) return null;
  return digits;
}

export function normalizeCnpj(value: string | null | undefined): string | null {
  const digits = normalizeDigits(value);
  if (!digits) return null;
  if (digits.length !== 14) return null;
  return digits;
}

export function normalizeParceiroHost(raw: string): string {
  return normalizeHost(raw);
}

export function validateParceiroHostForPersist(
  raw: string
): { ok: true; valor: string } | { ok: false; error: string } {
  const result = validateHostForPersist(raw);
  if (!result.ok) return result;
  if (result.valor === "gauchinhoconsorcios.com.br") {
    return { ok: false, error: "Host oficial da empresa não pode ser domínio de parceiro." };
  }
  if (result.valor.includes("*")) {
    return { ok: false, error: "Wildcard não permitido." };
  }
  return result;
}

export { normalizeHost };
