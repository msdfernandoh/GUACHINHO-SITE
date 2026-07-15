import type { ContratacaoOrigem } from "./types";

type FlatFields = {
  tipo_bem: string | null;
  credito_selecionado: number | null;
  parcela_estimada: number | null;
  prazo: number | null;
  grupo_id: string | null;
  grupo_nome: string | null;
  administradora: string | null;
  cota_id: string | null;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function extrairCamposFlat(
  origem: ContratacaoOrigem,
  dados: Record<string, unknown>,
): FlatFields {
  if (origem === "simulador") {
    const modo = str(dados.modo);
    const tipoBem = str(dados.tipoBem);
    const entrada = (dados.entrada ?? {}) as Record<string, unknown>;
    const resultado = (dados.resultado ?? {}) as Record<string, unknown>;
    const tipoLabel =
      tipoBem === "imovel" ? "Imóvel" : tipoBem === "automovel" ? "Veículo" : tipoBem;
    const credito =
      num(entrada.valorCredito) ??
      num(entrada.valorBem) ??
      num(resultado.valorCredito);
    const prazo = num(entrada.prazoMeses) ?? num(resultado.prazoMeses);
    const parcela =
      num(resultado.parcelaEstimada) ??
      num((resultado as { consorcio?: { parcelaEstimada?: number } }).consorcio?.parcelaEstimada);
    return {
      tipo_bem: modo === "financiamento" ? `Financiamento — ${tipoLabel ?? "—"}` : tipoLabel,
      credito_selecionado: credito,
      parcela_estimada: parcela,
      prazo: prazo != null ? Math.round(prazo) : null,
      grupo_id: null,
      grupo_nome: null,
      administradora: null,
      cota_id: null,
    };
  }

  const selecoes = Array.isArray(dados.selecoes) ? dados.selecoes : [];
  const first = (selecoes[0] ?? {}) as Record<string, unknown>;
  const grupo = (first.grupo ?? {}) as Record<string, unknown>;
  const resultado = (first.resultado ?? {}) as Record<string, unknown>;
  const credito =
    num(resultado.somaCotas) ??
    num(resultado.creditoLiquido) ??
    num(dados.creditoLiquidoTotal);
  const parcela = num(resultado.primeiraParcela) ?? num(dados.primeiraParcelaTotal);
  const prazo = num(grupo.prazo_meses) ?? num(grupo.prazo_total) ?? num(resultado.parcelasRestantesPosContemplacao);

  return {
    tipo_bem: str(grupo.modalidade) ?? str(dados.modalidadeResumo),
    credito_selecionado: credito,
    parcela_estimada: parcela,
    prazo: prazo != null ? Math.round(prazo) : null,
    grupo_id: str(grupo.id) ?? str(first.grupoId),
    grupo_nome: str(grupo.codigo_grupo) ?? str(grupo.nome),
    administradora: str(grupo.administradora),
    cota_id: str(first.cotaId),
  };
}

export function resumoFinanceiroFromDados(
  origem: ContratacaoOrigem,
  dados: Record<string, unknown>,
): Record<string, number | string | null> {
  if (origem === "simulador") {
    const resultado = (dados.resultado ?? {}) as Record<string, unknown>;
    const entrada = (dados.entrada ?? {}) as Record<string, unknown>;
    const opcao = (resultado.opcaoParcela ?? {}) as Record<string, unknown>;
    return {
      parcelaReduzida: num(resultado.parcelaReduzida) ?? num(opcao.parcelaReduzida),
      parcelaIntegral: num(resultado.parcelaAmortizacao) ?? num(resultado.parcelaIntegral),
      lanceEmbutido: num(entrada.lanceEmbutido) ?? num(resultado.lanceEmbutido),
      recursoProprio: num(entrada.entrada) ?? num(resultado.lanceProprio),
      lanceTotal: num(resultado.lanceTotal),
      creditoLiquido: num(resultado.creditoLiquidoPosLance) ?? num(resultado.creditoLiquido),
      saldoPosLance: num(resultado.saldoPosLance) ?? num(resultado.saldoDevedorEstimado),
      seguro: num(resultado.seguroMensal),
      parcelaPosContemplacao: num(resultado.parcelaPosContemplacao),
    };
  }
  const selecoes = Array.isArray(dados.selecoes) ? dados.selecoes : [];
  const totais = (dados.totais ?? {}) as Record<string, unknown>;
  const first = (selecoes[0] ?? {}) as Record<string, unknown>;
  const config = (first.config ?? {}) as Record<string, unknown>;
  const resultado = (first.resultado ?? {}) as Record<string, unknown>;
  let parcelaReduzida = num(resultado.parcelaReduzida);
  if (str(config.modalidadeParcela) === "personalizada") {
    parcelaReduzida =
      num(resultado.parcelaPersonalizada) ??
      num(resultado.parcelaBase) ??
      parcelaReduzida;
  }
  const parcelaIntegral =
    num(resultado.parcelaIntegral) ?? num(resultado.parcelaBase) ?? num(totais.parcelaIntegral);
  return {
    saldoDevedor:
      num(resultado.saldoDevedorInicial) ?? num(totais.saldoDevedorInicial),
    parcelaReduzida,
    parcelaIntegral,
    lanceEmbutido: num(resultado.lanceEmbutido) ?? num(totais.lanceEmbutido),
    recursoProprio: num(resultado.recursoProprio) ?? num(totais.recursoProprio),
    lanceTotal: num(resultado.lanceTotal) ?? num(totais.lanceTotal),
    creditoLiquido: num(resultado.creditoLiquido) ?? num(totais.creditoLiquido),
    saldoPosLance: num(resultado.saldoPosLance) ?? num(totais.saldoPosLance),
    seguro: num(resultado.seguroMensal) ?? num(totais.seguroTotal),
    parcelaPosContemplacao:
      num(resultado.parcelaPosContemplacao) ??
      num(totais.parcelaPosContemplacaoTotal) ??
      num(totais.parcelaPosContemplacao),
  };
}
