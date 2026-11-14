/** Normaliza idades informadas (0 a 40 anos, inteiras) e limita a 10 filhos. */
export function normalizarIdadesFilhos(raw: unknown): number[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) throw new Error("Idades dos filhos inválidas");
  if (raw.length === 0) return null;
  if (raw.length > 10) throw new Error("Informe no máximo 10 filhos");
  return raw.map((v) => {
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isInteger(n) || n < 0 || n > 40) throw new Error("Informe a idade de cada filho (0 a 40 anos)");
    return n;
  });
}

/** Texto legível para a observação do participante e o histórico do lead. */
export function resumoFilhos(idades: number[]): string {
  const lista = idades.map((i) => (i === 0 ? "menos de 1 ano" : `${i} ${i === 1 ? "ano" : "anos"}`));
  const fim = lista.length > 1 ? `${lista.slice(0, -1).join(", ")} e ${lista.at(-1)}` : lista[0];
  return `${idades.length} ${idades.length === 1 ? "filho" : "filhos"} — ${fim}`;
}
