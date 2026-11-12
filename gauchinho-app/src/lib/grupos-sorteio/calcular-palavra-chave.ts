export function validarPrimeiroPremio(primeiroPremio: string): boolean {
  return /^\d{5}$/.test(primeiroPremio);
}

export function validarQuantidadeCotas(quantidadeCotas: number): boolean {
  return Number.isInteger(quantidadeCotas) && quantidadeCotas > 0;
}

export function calcularPalavraChave(primeiroPremio: string, quantidadeCotas: number): number {
  if (!validarPrimeiroPremio(primeiroPremio)) {
    throw new Error("O 1º Prêmio deve conter exatamente 5 dígitos.");
  }

  if (!validarQuantidadeCotas(quantidadeCotas)) {
    throw new Error("A quantidade de cotas deve ser um número inteiro maior que zero.");
  }

  return Number(primeiroPremio) % quantidadeCotas;
}

export function resolverQuantidadeCotasGrupo(grupo: {
  capacidade_total?: number | null;
  quantidade_cotas_sorteio?: number | null;
}): number | null {
  for (const valor of [grupo.capacidade_total, grupo.quantidade_cotas_sorteio]) {
    if (valor != null && validarQuantidadeCotas(Number(valor))) return Number(valor);
  }
  return null;
}
