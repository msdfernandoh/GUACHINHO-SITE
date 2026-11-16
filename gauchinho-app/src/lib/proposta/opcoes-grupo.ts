type Json = Record<string, unknown>;

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function positive(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function opcoesGrupoProposta(value: unknown) {
  const dados = object(value);
  if (!Array.isArray(dados.selecoes)) return [];
  return dados.selecoes.flatMap((raw, indice) => {
    const linha = object(raw);
    const grupo = object(linha.grupo);
    const resultado = object(linha.resultado);
    const config = object(linha.config);
    const grupoId = String(linha.grupoId ?? grupo.id ?? "");
    const cotaId = String(linha.cotaId ?? object(linha.cota).id ?? "");
    const quantidade = positive(config.quantidadeCotas ?? resultado.quantidadeCotas) ?? 1;
    const creditoUnitario = positive(linha.credito ?? object(linha.cota).valor_credito);
    const credito = positive(resultado.somaCotas) ?? (creditoUnitario ? creditoUnitario * quantidade : null);
    const parcela = positive(resultado.primeiraParcela) ?? (positive(resultado.parcelaBase) ?? 0) * quantidade;
    if (!grupoId || !cotaId) return [];
    return [{
      indice, grupoId, cotaId, quantidade, credito, parcela,
      codigo: String(linha.codigoGrupo ?? grupo.codigo_grupo ?? ""),
      modalidade: String(config.modalidadeParcela ?? ""),
      seguro: typeof config.usaSeguro === "boolean" ? config.usaSeguro : null,
      prazo: positive(grupo.prazo_meses ?? grupo.prazo_total),
      linha,
    }];
  });
}
