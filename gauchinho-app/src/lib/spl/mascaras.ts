const dig = (v: string) => v.replace(/\D/g, "");

/** (66) 99999-9999 ou (66) 9999-9999. */
export function mascaraTelefone(v: string): string {
  const d = dig(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** 00.000.000/0000-00 */
export function mascaraCnpj(v: string): string {
  const d = dig(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** 000.000.000-00 */
export function mascaraCpf(v: string): string {
  const d = dig(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export const PIX_TIPOS = [
  { value: "CELULAR", label: "Celular", placeholder: "(66) 99999-9999" },
  { value: "CPF", label: "CPF", placeholder: "000.000.000-00" },
  { value: "CNPJ", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { value: "EMAIL", label: "E-mail", placeholder: "nome@empresa.com.br" },
  { value: "ALEATORIA", label: "Aleatória", placeholder: "Cole a chave aleatória" },
] as const;

export type PixTipo = (typeof PIX_TIPOS)[number]["value"];

export function mascaraPix(tipo: PixTipo | "", v: string): string {
  if (tipo === "CELULAR") return mascaraTelefone(v);
  if (tipo === "CPF") return mascaraCpf(v);
  if (tipo === "CNPJ") return mascaraCnpj(v);
  if (tipo === "EMAIL") return v.trim().toLowerCase().slice(0, 120);
  return v.trim().slice(0, 60);
}
