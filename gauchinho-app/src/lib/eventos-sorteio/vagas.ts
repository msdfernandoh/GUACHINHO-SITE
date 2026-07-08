import { digitsOnlyPhone } from "@/lib/utils/format";

export function normalizeTelefoneSorteio(telefone: string): string {
  const d = digitsOnlyPhone(telefone);
  return d || telefone.replace(/\D/g, "");
}

export function telefoneSorteioValido(telefone: string): boolean {
  const d = normalizeTelefoneSorteio(telefone);
  return d.length >= 10 && d.length <= 13;
}

export function telefoneJaParticipouSorteio(
  telefone: string,
  telefonesExistentes: string[],
  permitirDuplicado: boolean,
): boolean {
  if (permitirDuplicado) return false;
  const norm = normalizeTelefoneSorteio(telefone);
  if (!norm) return false;
  return telefonesExistentes.some((t) => normalizeTelefoneSorteio(t) === norm);
}
