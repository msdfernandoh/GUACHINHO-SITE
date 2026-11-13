import { formatWhatsappBrInput } from "@/lib/utils/format";

/** Máscara enquanto digita: EUA (407) 555-1234 · Brasil (66) 99608-6030. */
export function mascararTelefone(ddi: string, raw: string): string {
  if (ddi === "+55") return formatWhatsappBrInput(raw);
  let d = raw.replace(/\D/g, "");
  // Quem cola o número com o 1 do país na frente (1 407 555 1234).
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** EUA exige 10 dígitos; Brasil 10 (fixo) ou 11 (celular). */
export function telefoneCompleto(ddi: string, numero: string): boolean {
  const n = numero.replace(/\D/g, "").length;
  return ddi === "+55" ? n === 10 || n === 11 : n === 10;
}
