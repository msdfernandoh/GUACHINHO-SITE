type GrupoCatalogoKey = {
  id: string;
  administradora_id?: string | null;
  codigo_grupo?: string | null;
  origem_governanca?: string | null;
};

type SolicitacaoGrupoKey = {
  id: string;
  empresa_id?: string | null;
  administradora_id?: string | null;
  codigo_grupo?: string | null;
  grupo_id?: string | null;
};

function codigoNormalizado(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

export function deduplicarCatalogoGrupos<T extends GrupoCatalogoKey>(rows: T[]): T[] {
  const unicos = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.administradora_id ?? "sem-admin"}:${codigoNormalizado(row.codigo_grupo) || row.id}`;
    const atual = unicos.get(key);
    if (!atual || (atual.origem_governanca !== "GLOBAL" && row.origem_governanca === "GLOBAL")) {
      unicos.set(key, row);
    }
  }
  return [...unicos.values()];
}

export function deduplicarSolicitacoesGrupos<T extends SolicitacaoGrupoKey>(rows: T[]): T[] {
  const unicos = new Map<string, T>();
  for (const row of rows) {
    const key = row.grupo_id
      ? `grupo:${row.grupo_id}`
      : `${row.empresa_id ?? "sem-empresa"}:${row.administradora_id ?? "sem-admin"}:${codigoNormalizado(row.codigo_grupo) || row.id}`;
    if (!unicos.has(key)) unicos.set(key, row);
  }
  return [...unicos.values()];
}
