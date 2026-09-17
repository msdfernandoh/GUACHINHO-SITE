const COMISSAO_LABELS: Record<string, string> = {
  MASTER: "Master",
  GESTOR: "Master",
  SOCIO: "Sócio",
  SÓCIO: "Sócio",
  INDICADOR: "Indicação",
  INDICACAO: "Indicação",
  INDICAÇÃO: "Indicação",
  MICROFRANQUIA: "Microfranquia",
  PARCEIRO: "Parceiro",
  SDR: "SDR",
  SRD: "SDR",
  CONSULTOR: "Consultor",
};

const PRIORIDADE = ["MASTER", "GESTOR", "SOCIO", "SÓCIO", "INDICADOR", "INDICACAO", "INDICAÇÃO", "SDR", "SRD", "MICROFRANQUIA", "PARCEIRO", "CONSULTOR"];

export function tipoComissaoLabel(tipos: readonly string[] | null | undefined): string | null {
  const normalizados = new Set((tipos ?? []).map((tipo) => tipo.trim().toUpperCase()));
  const codigo = PRIORIDADE.find((tipo) => normalizados.has(tipo));
  return codigo ? COMISSAO_LABELS[codigo] : null;
}

export function nomeComTipoComissao(
  nome: string,
  tipos: readonly string[] | null | undefined,
): string {
  const label = tipoComissaoLabel(tipos);
  return label ? `${label} · ${nome}` : nome;
}

export function nomeComPerfilComissao(
  nome: string,
  perfis: readonly (string | null | undefined)[] | null | undefined,
  tiposFallback?: readonly string[] | null,
): string {
  const nomes = [...new Set(
    (perfis ?? [])
      .map((perfil) => perfil?.trim())
      .filter((perfil): perfil is string => Boolean(perfil)),
  )];
  if (nomes.length === 1) return `${nomes[0]} · ${nome}`;
  return nomeComTipoComissao(nome, tiposFallback);
}
