function numeroInteiroPositivo(value: unknown): number | null {
  const numero = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numero) && numero > 0 && numero <= 100 ? numero : null;
}

/**
 * Lê a quantidade congelada pelo simulador sem confundir quantidade de grupos
 * com quantidade de cotas. Snapshots antigos continuam com o fallback seguro 1.
 */
export function obterQuantidadeCotasContratacao(
  dadosSimulacao: Record<string, unknown> | null | undefined,
  quantidadePersistida?: number | null,
): number {
  const dados = (dadosSimulacao ?? {}) as Record<string, any>;
  const selecao = Array.isArray(dados.selecoes) ? dados.selecoes[0] : null;

  return (
    numeroInteiroPositivo(quantidadePersistida) ??
    numeroInteiroPositivo(dados.quantidade_cotas_formalizacao) ??
    numeroInteiroPositivo(selecao?.config?.quantidadeCotas) ??
    numeroInteiroPositivo(selecao?.resultado?.quantidadeCotas) ??
    numeroInteiroPositivo(dados.totais?.totalCotas) ??
    1
  );
}
