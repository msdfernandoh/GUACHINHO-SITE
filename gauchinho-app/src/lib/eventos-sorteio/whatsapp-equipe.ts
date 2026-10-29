import { digitsOnlyPhone } from "@/lib/utils/format";

export const WHATSAPP_EQUIPE_EVENTO_PADRAO = "5566999126120";

/** Campo BR com DDD; aceita também o prefixo +55 ao colar. */
export function normalizarWhatsappEquipeEvento(value: string): string | null {
  let digits = digitsOnlyPhone(value);
  if (!digits) return null;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (!/^[1-9]\d{9,10}$/.test(digits)) throw new Error("Informe o WhatsApp da equipe com DDD e 10 ou 11 dígitos.");
  return digits;
}

export function resolverWhatsappEquipeEvento(value?: string | null): string {
  try {
    const numero = normalizarWhatsappEquipeEvento(value ?? "");
    return numero ? `55${numero}` : WHATSAPP_EQUIPE_EVENTO_PADRAO;
  } catch {
    return WHATSAPP_EQUIPE_EVENTO_PADRAO;
  }
}
