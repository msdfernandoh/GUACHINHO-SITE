import {
  agregarResultadosLinhas,
  calcularLinhaSimulacaoGrupo,
  defaultConfigLinha,
  listarModalidadesLanceAtivas,
  type ConfigLinhaSimulacaoGrupo,
  type ResultadoLinhaSimulacaoGrupo,
} from "@/lib/grupos/simulacao-linha";
import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";

export type PlanoConsorcioParams = {
  /** Percentual da parcela reduzida (ex.: 70 no SPL, 60 no Econômico). */
  reduzida: number;
  /** Percentual do lance embutido (ex.: 25). */
  embutido: number;
};

export type ItemComposicao = {
  cota: GrupoCota;
  quantidade: number;
  config: ConfigLinhaSimulacaoGrupo;
  resultado: ResultadoLinhaSimulacaoGrupo;
};

export type OpcaoComposicao = {
  posicao: "abaixo" | "acima";
  itens: ItemComposicao[];
  totalCotas: number;
  creditoContratado: number;
  creditoLiquido: number;
  lanceEmbutido: number;
  parcelaAteContemplar: number;
  parcelaPosContemplacao: number;
  /** Descrição curta: "2 × R$ 250 mil + 1 × R$ 300 mil". */
  resumo: string;
};

const mil = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`
    : `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;

/** Cotas ativas com crédito, sem repetir valor. */
export function cotasElegiveis(cotas: GrupoCota[]): GrupoCota[] {
  const porValor = new Map<number, GrupoCota>();
  for (const c of [...cotas].sort((a, b) => a.ordem - b.ordem)) {
    const valor = Number(c.valor_credito);
    if (!c.ativo || !Number.isFinite(valor) || valor <= 0) continue;
    if (String(c.status ?? "").toLowerCase().match(/esgot|inativ|encerr/)) continue;
    if (!porValor.has(valor)) porValor.set(valor, c);
  }
  return [...porValor.values()].sort((a, b) => Number(a.valor_credito) - Number(b.valor_credito));
}

/** Configuração da linha com a parcela reduzida e o lance embutido do plano. */
export function configDoPlano(
  grupo: GrupoConsorcio,
  cotas: GrupoCota[],
  modalidades: GrupoModalidadeLance[],
  cota: GrupoCota,
  quantidade: number,
  plano: PlanoConsorcioParams,
): ConfigLinhaSimulacaoGrupo {
  const base = defaultConfigLinha(grupo, cotas, modalidades);
  const mods = listarModalidadesLanceAtivas(grupo, modalidades);
  const alvo = Math.round(plano.embutido * 100) / 100;
  const mod =
    mods.find((m) => Math.abs(Number(m.percentual_lance_embutido) - alvo) < 0.01) ??
    (plano.embutido > 0 ? mods.find((m) => Number(m.percentual_lance_embutido) > 0) : undefined) ??
    null;
  return {
    ...base,
    cotaId: cota.id,
    quantidadeCotas: quantidade,
    modalidadeParcela: plano.reduzida > 0 && plano.reduzida < 100 ? "reduzida" : "integral",
    percentualParcelaReduzida: plano.reduzida > 0 && plano.reduzida < 100 ? plano.reduzida : base.percentualParcelaReduzida,
    usaLanceEmbutido: !!mod && plano.embutido > 0,
    modalidadeLanceId: mod?.id ?? null,
    usaRecursoProprio: false,
    recursoProprioInput: 0,
  };
}

/**
 * DP sobre o crédito somado (em mil reais) com exatamente `n` cotas.
 * Retorna, para cada soma alcançável, uma composição (contagem por índice de cota),
 * preferindo menos valores diferentes.
 */
function composicoesComNCotas(valoresMil: number[], n: number, limiteMil: number): Map<number, number[]> {
  type Estado = { contagem: number[]; distintos: number };
  let atual = new Map<number, Estado>([[0, { contagem: valoresMil.map(() => 0), distintos: 0 }]]);
  for (let passo = 0; passo < n; passo++) {
    const prox = new Map<number, Estado>();
    for (const [soma, est] of atual) {
      valoresMil.forEach((v, idx) => {
        const s = soma + v;
        if (s > limiteMil) return;
        const contagem = [...est.contagem];
        const novoValor = contagem[idx] === 0;
        contagem[idx] += 1;
        const distintos = est.distintos + (novoValor ? 1 : 0);
        const existente = prox.get(s);
        if (!existente || distintos < existente.distintos) prox.set(s, { contagem, distintos });
      });
    }
    atual = prox;
  }
  return new Map([...atual].map(([s, e]) => [s, e.contagem]));
}

function montarOpcao(
  posicao: "abaixo" | "acima",
  contagem: number[],
  elegiveis: GrupoCota[],
  grupo: GrupoConsorcio,
  cotas: GrupoCota[],
  modalidades: GrupoModalidadeLance[],
  plano: PlanoConsorcioParams,
): OpcaoComposicao {
  const itens: ItemComposicao[] = [];
  contagem.forEach((qtd, idx) => {
    if (qtd <= 0) return;
    const cota = elegiveis[idx]!;
    const config = configDoPlano(grupo, cotas, modalidades, cota, qtd, plano);
    const resultado = calcularLinhaSimulacaoGrupo({ grupo, cota, config, modalidades });
    itens.push({ cota, quantidade: qtd, config, resultado });
  });
  itens.sort((a, b) => Number(b.cota.valor_credito) - Number(a.cota.valor_credito));
  const tot = agregarResultadosLinhas(itens.map((i) => i.resultado));
  return {
    posicao,
    itens,
    totalCotas: tot.totalCotas,
    creditoContratado: tot.somaCotas,
    creditoLiquido: Math.round(tot.creditoLiquido * 100) / 100,
    lanceEmbutido: Math.round(tot.lanceEmbutido * 100) / 100,
    parcelaAteContemplar: Math.round(tot.primeiraParcela * 100) / 100,
    parcelaPosContemplacao: Math.round(tot.parcelaPosContemplacaoTotal * 100) / 100,
    resumo: itens.map((i) => `${i.quantidade} × ${mil(Number(i.cota.valor_credito))}`).join(" + "),
  };
}

/**
 * Monta, com o máximo de cotas possível, as duas composições cujo crédito líquido
 * fica mais perto do valor pedido: uma logo abaixo e outra logo acima.
 */
export function sugerirComposicoes(args: {
  grupo: GrupoConsorcio;
  cotas: GrupoCota[];
  modalidades: GrupoModalidadeLance[];
  plano: PlanoConsorcioParams;
  valorLiquidoDesejado: number;
}): OpcaoComposicao[] {
  const { grupo, cotas, modalidades, plano } = args;
  const alvo = Math.max(0, args.valorLiquidoDesejado);
  const elegiveis = cotasElegiveis(cotas);
  if (!elegiveis.length || alvo <= 0) return [];

  // Crédito líquido de 1 cota de cada valor: a razão líquido/crédito do grupo.
  const liquidos = elegiveis.map((cota) => {
    const config = configDoPlano(grupo, cotas, modalidades, cota, 1, plano);
    return calcularLinhaSimulacaoGrupo({ grupo, cota, config, modalidades }).creditoLiquido;
  });
  const razao = liquidos.reduce((a, l, i) => a + l / Number(elegiveis[i]!.valor_credito), 0) / liquidos.length;
  if (!(razao > 0)) return [];

  const creditoAlvo = alvo / razao;
  const valoresMil = elegiveis.map((c) => Math.round(Number(c.valor_credito) / 1000));
  const menor = Math.min(...valoresMil);
  const maior = Math.max(...valoresMil);
  const alvoMil = creditoAlvo / 1000;
  // Máximo de cotas: quantas das menores cartas cabem no valor.
  const nMax = Math.max(1, Math.floor(alvoMil / menor));
  const n = Math.min(nMax, 40);

  const liquidoDe = (contagem: number[]) =>
    contagem.reduce((a, q, i) => a + q * liquidos[i]!, 0);

  let abaixo: number[] | null = null;
  let acima: number[] | null = null;
  for (const qtd of [n, n + 1]) {
    if (abaixo && acima) break;
    const mapa = composicoesComNCotas(valoresMil, qtd, Math.ceil(alvoMil + maior));
    for (const contagem of mapa.values()) {
      const liq = liquidoDe(contagem);
      if (liq <= alvo && qtd === n && (!abaixo || liq > liquidoDe(abaixo))) abaixo = contagem;
      if (liq >= alvo && (!acima || liq < liquidoDe(acima))) acima = contagem;
    }
  }

  const opcoes: OpcaoComposicao[] = [];
  if (abaixo) opcoes.push(montarOpcao("abaixo", abaixo, elegiveis, grupo, cotas, modalidades, plano));
  if (acima) {
    const op = montarOpcao("acima", acima, elegiveis, grupo, cotas, modalidades, plano);
    if (!opcoes.some((o) => o.resumo === op.resumo)) opcoes.push(op);
  }
  return opcoes;
}

/** Grupo do catálogo cujo código começa com o número informado (ex.: "1553"). */
export function acharGrupoPorCodigo<T extends { grupo: GrupoConsorcio }>(aggs: T[], codigo: string): T | null {
  const alvo = codigo.trim();
  return aggs.find((a) => String(a.grupo.codigo_grupo ?? "").trim().split(/\s+/)[0] === alvo) ?? null;
}
