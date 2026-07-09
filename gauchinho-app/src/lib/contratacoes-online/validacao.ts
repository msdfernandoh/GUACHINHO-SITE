export function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function sanitizeCpf(value: string): string {
  return sanitizeDigits(value).slice(0, 11);
}

export function sanitizeCnpj(value: string): string {
  return sanitizeDigits(value).slice(0, 14);
}

export function sanitizeTelefone(value: string): string {
  return sanitizeDigits(value).slice(0, 13);
}

function cpfChecksum(digits: string, factor: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i], 10) * (factor - i);
  }
  const mod = (sum * 10) % 11;
  return mod === 10 ? 0 : mod;
}

export function validarCpf(raw: string): boolean {
  const cpf = sanitizeCpf(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  const base = cpf.slice(0, 9);
  const d1 = cpfChecksum(base, 10);
  const d2 = cpfChecksum(base + d1, 11);
  return cpf === base + String(d1) + String(d2);
}

function cnpjDigit(cnpj: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += parseInt(cnpj[i], 10) * weights[i];
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export function validarCnpj(raw: string): boolean {
  const cnpj = sanitizeCnpj(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = cnpjDigit(cnpj, w1);
  const d2 = cnpjDigit(cnpj.slice(0, 12) + d1, w2);
  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2);
}

export function validarEmail(email: string): boolean {
  const e = email.trim();
  if (!e || e.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
