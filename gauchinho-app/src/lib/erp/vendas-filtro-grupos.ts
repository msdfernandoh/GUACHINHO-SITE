type GrupoFiltro = { grupo_id?: string | null; codigo?: string | null };

function rotuloGrupo(codigo?: string | null) {
  return (codigo ?? "").trim().replace(/\s+/g, " ").replace(/^0+(?=\d)/, "");
}

export function chaveGrupoFiltro(grupoId?: string | null, codigo?: string | null) {
  // UUID mantém grupos distintos mesmo quando possuem o mesmo número comercial.
  return grupoId || rotuloGrupo(codigo).toLocaleUpperCase("pt-BR");
}

export function listarGruposFiltro(grupos: GrupoFiltro[]) {
  const opcoes = new Map<string, string>();
  for (const grupo of grupos) {
    const nome = rotuloGrupo(grupo.codigo);
    if (!nome) continue;
    const id = chaveGrupoFiltro(grupo.grupo_id, grupo.codigo);
    const anterior = opcoes.get(id);
    if (!anterior || nome.length > anterior.length) opcoes.set(id, nome);
  }
  return [...opcoes].map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
}
