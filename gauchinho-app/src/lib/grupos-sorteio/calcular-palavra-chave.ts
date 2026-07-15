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
