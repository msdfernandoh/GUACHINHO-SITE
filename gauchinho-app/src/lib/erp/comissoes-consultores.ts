export type ConsultorComissoes = {
  id: string;
  nome: string;
  nome_exibicao: string | null;
  usuario_id: string | null;
  cpf?: string | null;
};

export function normalizarNomeConsultor(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/** Agrupamento de apresentação do legado; nunca transfere identidade ou fatos financeiros. */
export function agruparConsultoresComissoes(participantes: ConsultorComissoes[], usuarioId?: string) {
  const grupos = new Map<string, ConsultorComissoes[]>();
  for (const item of participantes) {
    const nome = normalizarNomeConsultor(item.nome);
    const chave = nome || item.id;
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  return [...grupos.values()].flatMap((grupo) => {
    const documentos = new Set(grupo.map((p) => p.cpf?.replace(/\D/g, "")).filter(Boolean));
    // Homônimos com documentos diferentes continuam separados.
    const conjuntos = documentos.size > 1 ? grupo.map((p) => [p]) : [grupo];
    return conjuntos.map((itens) => {
      const principal = itens.find((p) => p.usuario_id === usuarioId)
        ?? itens.find((p) => p.usuario_id) ?? itens[0];
      return { ...principal, ids: itens.map((p) => p.id) };
    });
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
