export function periodoFromAnoMes(ano: number, mes: number): {
  ano: number;
  mes: number;
  periodoRef: string;
} {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    throw new Error("Ano inválido.");
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error("Mês inválido.");
  }
  const periodoRef = `${ano}-${String(mes).padStart(2, "0")}-01`;
  return { ano, mes, periodoRef };
}

export function periodoFromInput(anoMes: string): { ano: number; mes: number; periodoRef: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(anoMes.trim());
  if (!m) throw new Error("Período inválido. Use o formato AAAA-MM.");
  return periodoFromAnoMes(Number(m[1]), Number(m[2]));
}

export function formatPeriodoBr(ano: number, mes: number): string {
  return `${String(mes).padStart(2, "0")}/${ano}`;
}
