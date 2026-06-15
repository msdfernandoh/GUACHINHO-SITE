export function fmtMoney(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function fmtDateBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export function fmtPrazo(meses: number | null): string {
  if (!meses) return "—";
  return `${meses} meses`;
}
