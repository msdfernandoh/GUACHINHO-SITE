const PARCERIA_LABELS: Record<string, string> = {
  MICROFRANQUIA: "Microfranquia",
  PARCEIRO: "Parceiro",
  SDR: "SDR",
  SRD: "SDR",
  CONSULTOR: "Consultor",
};

const PRIORIDADE = ["MICROFRANQUIA", "PARCEIRO", "SDR", "SRD", "CONSULTOR"];

export function modeloParceriaLabel(tipos: readonly string[] | null | undefined): string | null {
  const normalizados = new Set((tipos ?? []).map((tipo) => tipo.trim().toUpperCase()));
  const codigo = PRIORIDADE.find((tipo) => normalizados.has(tipo));
  return codigo ? PARCERIA_LABELS[codigo] : null;
}

export function nomeComModeloParceria(
  nome: string,
  tipos: readonly string[] | null | undefined,
): string {
  const label = modeloParceriaLabel(tipos);
  return label ? `${label} · ${nome}` : nome;
}
