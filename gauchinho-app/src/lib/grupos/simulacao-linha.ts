import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import {
  calcularCreditoLiquidoPosContemplacao,
  calcularLanceEmbutidoLinha,
  calcularParcelasLinhaGrupo,
  calcularParcelasRestantes,
  calcularSaldoDevedorSimulacao,
  grupoToParametros,
  grupoUsaSeguroNaParcela,
  type ParametrosGrupo,
} from "./calculos";
import { fatorSeguroGrupo } from "./seguro";
import { calcularPrazoGrupoFromRow } from "./prazos";
import { normalizarPercentualGrupo } from "./percentual";
import { parcelaTipoFromModalidade } from "./modalidades-admin";

export type ModalidadeParcelaLinha = "reduzida" | "integral" | "personalizada";
export type RecursoProprioModo = "percentual" | "valor";
export type TipoBemPrazoPosContemplacao = "imovel" | "veiculo";

export function calcularPosContemplacaoPorTipo(args: {
  tipo: TipoBemPrazoPosContemplacao;
  saldoDevedor: number;
  lanceTotal: number;
  primeiraParcela: number;
  parcelasARealizar: number;
}): { parcelaPosContemplacao: number; prazoRestanteAposContemplacao: number } {
  const { tipo, saldoDevedor, lanceTotal, primeiraParcela, parcelasARealizar } = args;
  const divisor = parcelasARealizar - 1;

  if (divisor <= 0) {
    return { parcelaPosContemplacao: 0, prazoRestanteAposContemplacao: 0 };
  }

  const taxaMinima = tipo === "veiculo" ? 0.007 : 0;
  const baseParcela =
    saldoDevedor - lanceTotal - (tipo === "veiculo" ? primeiraParcela : 0);
  const parcelaMinima = saldoDevedor * taxaMinima;
  const parcelaCalculada = baseParcela / divisor;
  const parcelaPosContemplacao = Math.max(parcelaMinima, parcelaCalculada);
  const prazoRestanteAposContemplacao =
    parcelaPosContemplacao > 0
      ? (saldoDevedor - lanceTotal - primeiraParcela) / parcelaPosContemplacao
      : 0;

  return { parcelaPosContemplacao, prazoRestanteAposContemplacao };
}

function tipoBemPrazoPosContemplacao(modalidade: string): TipoBemPrazoPosContemplacao {
  return modalidade.trim().toLocaleLowerCase("pt-BR") === "imóvel" ||
    modalidade.trim().toLocaleLowerCase("pt-BR") === "imovel"
    ? "imovel"
    : "veiculo";
}

/** Respeita a escolha na linha; estratégia de lance só define o padrão ao selecionar a modalidade. */
export function resolveParcelaTipoLinha(
  config: Pick<ConfigLinhaSimulacaoGrupo, "modalidadeParcela">,
  grupo: Pick<
    GrupoConsorcio,
    "tem_parcela_reduzida" | "permite_parcela_reduzida_personalizada" | "permite_parcela_integral"
  >,
): ModalidadeParcelaLinha {
  let t = config.modalidadeParcela;
  if (t === "personalizada" && !grupo.permite_parcela_reduzida_personalizada) {
    t = grupo.tem_parcela_reduzida ? "reduzida" : "integral";
  }
  if (t === "reduzida" && !grupo.tem_parcela_reduzida) t = "integral";
  if (t === "integral" && grupo.permite_parcela_integral === false) {
    t = grupo.tem_parcela_reduzida ? "reduzida" : "personalizada";
  }
  return t;
}

export type ConfigLinhaSimulacaoGrupo = {
  cotaId: string | null;
  quantidadeCotas: number;
  modalidadeParcela: ModalidadeParcelaLinha;
  /** Percentual sobre a integral quando modalidadeParcela = personalizada (ex.: 40). */
  percentualParcelaPersonalizada: number | null;
  usaLanceEmbutido: boolean;
  modalidadeLanceId: string | null;
  usaRecursoProprio: boolean;
  recursoProprioModo: RecursoProprioModo;
  recursoProprioInput: number;
  usaSeguro: boolean;
};

export type ResultadoLinhaSimulacaoGrupo = {
  ativo: boolean;
  somaCotas: number;
  saldoDevedorInicial: number;
  /** Saldo devedor − lance total (base comercial dos lances). */
  saldoPosLance: number;
  /** Saldo após lance e 1ª parcela sem seguro (base do seguro pós na planilha). */
  saldoDevedorFinal: number;
  primeiraParcela: number;
  parcelaBase: number;
  parcelaIntegral: number;
  parcelaReduzida: number | null;
  parcelaPersonalizada: number | null;
  parcelaPosContemplacao: number;
  prazoRestanteAposContemplacao: number;
  lanceEmbutido: number;
  recursoProprio: number;
  lanceTotal: number;
  /** Seguro pós-contemplação (planilha: sobre saldo − lance − 1ª com seguro). */
  seguroMensal: number;
  /** Seguro da 1ª parcela sobre saldo cheio (planilha: saldo × 0,0004). */
  seguroPrimeiraParcela: number;
  creditoLiquido: number;
  parcelasRestantesPosContemplacao: number;
  percentualLanceEmbutido: number;
  percentualRecursoMinimo: number;
  avisoRecursoProprio: string | null;
  quantidadeCotas: number;
};

function num(v: number | null | undefined, fallback = 0): number {
  return v != null && Number.isFinite(v) ? v : fallback;
}

export function listarModalidadesLanceAtivas(
  grupo: GrupoConsorcio,
  modalidades: GrupoModalidadeLance[],
): GrupoModalidadeLance[] {
  const ativas = modalidades
    .filter((m) => m.ativo)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  if (ativas.length) return ativas;
  if (!grupo.permite_lance_embutido) return [];
  const pct = num(grupo.percentual_lance_embutido);
  if (pct <= 0) return [];
  return [
    {
      id: `fallback-${grupo.id}`,
      grupo_id: grupo.id,
      nome: `${pct}% embutido`,
      percentual_lance_embutido: pct,
      percentual_recurso_proprio_minimo: num(grupo.percentual_recurso_proprio_sugerido),
      descricao: null,
      ativo: true,
      ordem: 0,
      created_at: "",
      updated_at: "",
    },
  ];
}

function parcelaMensalDaCota(
  cota: GrupoCota,
  modalidade: ModalidadeParcelaLinha,
  grupo: GrupoConsorcio,
  usaSeguro: boolean,
  seguroUnitario: number,
): number {
  const usaSeguroGrupo = grupoUsaSeguroNaParcela(grupo);
  const integral = num(cota.parcela_integral ?? cota.parcela_sem_seguro);
  const reduzidaVal = cota.parcela_reduzida != null ? num(cota.parcela_reduzida) : null;
  const baseReduzida = reduzidaVal ?? (num(cota.valor_parcela) || integral);
  const baseIntegral = integral || baseReduzida;

  const base =
    modalidade === "reduzida" && grupo.tem_parcela_reduzida ? baseReduzida : baseIntegral;

  if (usaSeguro && usaSeguroGrupo) {
    if (
      modalidade === "integral" &&
      cota.parcela_com_seguro != null &&
      num(cota.parcela_com_seguro) > 0
    ) {
      return num(cota.parcela_com_seguro);
    }
    return Math.round((base + seguroUnitario) * 100) / 100;
  }

  if (cota.valor_parcela != null && modalidade === "reduzida") {
    return num(cota.valor_parcela);
  }
  return base;
}

function resolveModalidadeLance(
  config: ConfigLinhaSimulacaoGrupo,
  modalidades: GrupoModalidadeLance[],
): GrupoModalidadeLance | null {
  if (!modalidades.length) return null;
  if (config.modalidadeLanceId) {
    return modalidades.find((m) => m.id === config.modalidadeLanceId) ?? null;
  }
  if (!config.usaLanceEmbutido) return null;
  return modalidades.length === 1 ? modalidades[0]! : null;
}

export function resolveModalidadeLanceAtiva(
  config: ConfigLinhaSimulacaoGrupo,
  modalidades: GrupoModalidadeLance[],
): GrupoModalidadeLance | null {
  return resolveModalidadeLance(config, modalidades);
}

export type SnapshotLanceLinha = {
  modalidade_lance: {
    id: string | null;
    nome: string;
    percentual_lance_embutido: number;
    percentual_recurso_proprio_minimo: number;
  } | null;
  lance_embutido: { percentual: number; valor: number };
  recurso_proprio: {
    ativo: boolean;
    tipo: RecursoProprioModo;
    percentual: number | null;
    valor: number;
  };
  lance_total: number;
};

export function buildSnapshotLanceLinha(
  config: ConfigLinhaSimulacaoGrupo,
  resultado: ResultadoLinhaSimulacaoGrupo,
  mod: GrupoModalidadeLance | null,
): SnapshotLanceLinha {
  const modId =
    mod && !String(mod.id).startsWith("fallback-") ? mod.id : mod ? null : null;
  return {
    modalidade_lance: mod
      ? {
          id: modId,
          nome: mod.nome,
          percentual_lance_embutido: num(mod.percentual_lance_embutido),
          percentual_recurso_proprio_minimo: num(mod.percentual_recurso_proprio_minimo),
        }
      : null,
    lance_embutido: {
      percentual: resultado.percentualLanceEmbutido,
      valor: resultado.lanceEmbutido,
    },
    recurso_proprio: {
      ativo: config.usaRecursoProprio,
      tipo: config.recursoProprioModo,
      percentual:
        config.usaRecursoProprio && config.recursoProprioModo === "percentual"
          ? num(config.recursoProprioInput)
          : null,
      valor: resultado.recursoProprio,
    },
    lance_total: resultado.lanceTotal,
  };
}

export function calcularLinhaSimulacaoGrupo(args: {
  grupo: GrupoConsorcio;
  cota: GrupoCota | null;
  config: ConfigLinhaSimulacaoGrupo;
  modalidades: GrupoModalidadeLance[];
}): ResultadoLinhaSimulacaoGrupo {
  const { grupo, cota, config, modalidades } = args;
  const params: ParametrosGrupo = grupoToParametros(grupo);
  const qty = Math.max(0, Math.floor(config.quantidadeCotas || 0));
  const ativo = !!cota && !!config.cotaId && qty > 0;

  const empty: ResultadoLinhaSimulacaoGrupo = {
    ativo: false,
    somaCotas: 0,
    saldoDevedorInicial: 0,
    saldoPosLance: 0,
    saldoDevedorFinal: 0,
    primeiraParcela: 0,
    parcelaBase: 0,
    parcelaIntegral: 0,
    parcelaReduzida: null,
    parcelaPersonalizada: null,
    parcelaPosContemplacao: 0,
    prazoRestanteAposContemplacao: 0,
    lanceEmbutido: 0,
    recursoProprio: 0,
    lanceTotal: 0,
    seguroMensal: 0,
    seguroPrimeiraParcela: 0,
    creditoLiquido: 0,
    parcelasRestantesPosContemplacao: 0,
    percentualLanceEmbutido: 0,
    percentualRecursoMinimo: 0,
    avisoRecursoProprio: null,
    quantidadeCotas: 0,
  };

  if (!ativo || !cota) return empty;

  const valorCredito = num(cota.valor_credito);
  const somaCotas = valorCredito * qty;
  const saldoDevedorInicial = calcularSaldoDevedorSimulacao(somaCotas, params);

  const modalidadesAtivas = listarModalidadesLanceAtivas(grupo, modalidades);
  const modLance = resolveModalidadeLance(config, modalidadesAtivas);
  const pctEmbutido =
    modLance && config.usaLanceEmbutido
      ? normalizarPercentualGrupo(modLance.percentual_lance_embutido)
      : 0;
  const pctRecursoMin =
    modLance && config.usaLanceEmbutido
      ? normalizarPercentualGrupo(modLance.percentual_recurso_proprio_minimo)
      : 0;
  const parcelaTipoLinha = resolveParcelaTipoLinha(config, grupo);

  const lanceEmbutido =
    pctEmbutido > 0 ? calcularLanceEmbutidoLinha(saldoDevedorInicial, pctEmbutido) : 0;

  let recursoProprio = 0;
  if (config.usaRecursoProprio) {
    if (config.recursoProprioModo === "percentual") {
      recursoProprio = calcularLanceEmbutidoLinha(
        saldoDevedorInicial,
        num(config.recursoProprioInput),
      );
    } else {
      recursoProprio = Math.max(0, num(config.recursoProprioInput));
    }
  }

  let avisoRecursoProprio: string | null = null;
  if (config.usaLanceEmbutido && pctRecursoMin > 0) {
    const minimo = calcularLanceEmbutidoLinha(saldoDevedorInicial, pctRecursoMin);
    if (recursoProprio + 0.009 < minimo) {
      avisoRecursoProprio = `Recurso próprio mínimo: ${pctRecursoMin}% (${minimo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`;
    }
  }

  const pctPersonalLinha =
    parcelaTipoLinha === "personalizada"
      ? num(
          config.percentualParcelaPersonalizada ??
            grupo.percentual_parcela_reduzida_personalizada,
          0,
        )
      : null;

  const parcelasCalc = calcularParcelasLinhaGrupo({
    saldoDevedor: saldoDevedorInicial,
    prazoTotal: params.prazoTotal,
    quantidadeCotas: qty,
    temParcelaReduzida: !!grupo.tem_parcela_reduzida,
    percentualParcelaReduzida: num(grupo.percentual_parcela_reduzida, 100),
    modalidadeParcela: parcelaTipoLinha,
    percentualParcelaPersonalizada: pctPersonalLinha,
  });

  const fatorSeg = fatorSeguroGrupo(grupo.seguro_percentual);
  const temSeguroGrupo = params.seguroHabilitado && fatorSeg > 0;

  // Planilha: parcelaSemSeguro = (saldo / prazoTotal) * fatorParcela
  const parcelaSemSeguroUnit = parcelasCalc.parcelaExibida;
  const parcelaSemSeguroTotal = Math.round(parcelaSemSeguroUnit * qty * 100) / 100;

  // Planilha: seguro = saldoDevedor * 0,0004 (sobre o saldo cheio, antes do lance)
  const seguroInicialUnit =
    temSeguroGrupo && qty > 0
      ? Math.round((saldoDevedorInicial / qty) * fatorSeg * 100) / 100
      : 0;
  const seguroInicialTotal = Math.round(seguroInicialUnit * qty * 100) / 100;

  // Planilha: parcelaComSeguro = parcelaSemSeguro + seguro
  const parcelaComSeguroUnit =
    temSeguroGrupo && seguroInicialUnit > 0
      ? Math.round((parcelaSemSeguroUnit + seguroInicialUnit) * 100) / 100
      : parcelaSemSeguroUnit;
  const parcelaComSeguroTotal = Math.round(parcelaComSeguroUnit * qty * 100) / 100;

  // Toggle C/S: só a exibição da 1ª parcela; pós-contemplação sempre usa seguro.
  let parcelaBase = parcelaSemSeguroUnit;
  if (config.usaSeguro && seguroInicialUnit > 0) {
    parcelaBase = parcelaComSeguroUnit;
  }
  const primeiraParcela = Math.round(parcelaBase * qty * 100) / 100;

  const lanceTotal = lanceEmbutido + recursoProprio;
  const saldoPosLance = Math.max(
    0,
    Math.round((saldoDevedorInicial - lanceEmbutido - recursoProprio) * 100) / 100,
  );

  // Planilha: saldo após 1º mês = saldo − lance − parcelaComSeguro (sempre com seguro).
  // Ex.: 1.860.000 − 465.000 − 5.816,73 = 1.389.183,27
  const saldoDevedorFinal = Math.max(
    0,
    Math.round((saldoPosLance - parcelaComSeguroTotal) * 100) / 100,
  );

  const parcelasARealizar = calcularParcelasRestantes(params);

  // Fórmula comercial pós-contemplação: imóvel não desconta a 1ª parcela na
  // base da nova parcela; veículo desconta e aplica piso de 0,7% do saldo.
  const saldoDevedorPrazo =
    somaCotas * (1 + params.taxaAdministrativaPercentual / 100);
  const posContemplacao = calcularPosContemplacaoPorTipo({
    tipo: tipoBemPrazoPosContemplacao(grupo.modalidade),
    saldoDevedor: saldoDevedorPrazo,
    lanceTotal,
    primeiraParcela: parcelaComSeguroTotal,
    parcelasARealizar,
  });

  // Seguro pós permanece disponível separadamente para os demais demonstrativos.
  const seguroPosTotal = temSeguroGrupo
    ? Math.round(saldoDevedorFinal * fatorSeg * 100) / 100
    : 0;
  const parcelaPosContemplacao = posContemplacao.parcelaPosContemplacao;
  const prazoRestanteAposContemplacao = posContemplacao.prazoRestanteAposContemplacao;
  const parcelasRestantesPosContemplacao = prazoRestanteAposContemplacao;

  const creditoLiquido = calcularCreditoLiquidoPosContemplacao(somaCotas, lanceEmbutido);

  return {
    ativo: true,
    somaCotas,
    saldoDevedorInicial,
    saldoPosLance,
    saldoDevedorFinal,
    primeiraParcela,
    parcelaBase: Math.round(parcelaBase * 100) / 100,
    parcelaIntegral: parcelasCalc.parcelaIntegral,
    parcelaReduzida: parcelasCalc.parcelaReduzida,
    parcelaPersonalizada: parcelasCalc.parcelaPersonalizada,
    parcelaPosContemplacao,
    prazoRestanteAposContemplacao,
    lanceEmbutido,
    recursoProprio,
    lanceTotal,
    /** Seguro pós-contemplação (planilha col. N). */
    seguroMensal: seguroPosTotal,
    /** Seguro da 1ª parcela sobre saldo cheio (planilha col. K), se grupo tiver seguro. */
    seguroPrimeiraParcela: seguroInicialTotal,
    quantidadeCotas: qty,
    creditoLiquido,
    parcelasRestantesPosContemplacao,
    percentualLanceEmbutido: pctEmbutido,
    percentualRecursoMinimo: pctRecursoMin,
    avisoRecursoProprio,
  };
}

export function agregarResultadosLinhas(
  linhas: ResultadoLinhaSimulacaoGrupo[],
): {
  gruposSelecionados: number;
  totalCotas: number;
  somaCotas: number;
  primeiraParcela: number;
  parcelaIntegralTotal: number;
  parcelaReduzidaTotal: number;
  lanceEmbutido: number;
  recursoProprio: number;
  lanceTotal: number;
  saldoDevedorInicial: number;
  saldoPosLance: number;
  saldoDevedorFinal: number;
  seguroTotal: number;
  creditoLiquido: number;
  parcelaPosContemplacaoTotal: number;
  parcelasRestantesMax: number;
  prazoRestanteAposContemplacaoMax: number;
  parcelaPosContemplacaoMedia: number;
} {
  const ativas = linhas.filter((l) => l.ativo);
  const totalCotas = ativas.reduce((acc, l) => acc + l.quantidadeCotas, 0);
  return {
    gruposSelecionados: ativas.length,
    totalCotas,
    somaCotas: ativas.reduce((a, l) => a + l.somaCotas, 0),
    primeiraParcela: ativas.reduce((a, l) => a + l.primeiraParcela, 0),
    parcelaIntegralTotal: ativas.reduce((a, l) => a + l.parcelaIntegral, 0),
    parcelaReduzidaTotal: ativas.reduce(
      (a, l) => a + (l.parcelaPersonalizada ?? l.parcelaReduzida ?? 0),
      0,
    ),
    lanceEmbutido: ativas.reduce((a, l) => a + l.lanceEmbutido, 0),
    recursoProprio: ativas.reduce((a, l) => a + l.recursoProprio, 0),
    lanceTotal: ativas.reduce((a, l) => a + l.lanceTotal, 0),
    saldoDevedorInicial: ativas.reduce((a, l) => a + l.saldoDevedorInicial, 0),
    saldoPosLance: ativas.reduce((a, l) => a + l.saldoPosLance, 0),
    saldoDevedorFinal: ativas.reduce((a, l) => a + l.saldoDevedorFinal, 0),
    seguroTotal: ativas.reduce((a, l) => a + l.seguroMensal, 0),
    creditoLiquido: ativas.reduce((a, l) => a + l.creditoLiquido, 0),
    parcelaPosContemplacaoTotal: ativas.reduce((a, l) => a + l.parcelaPosContemplacao, 0),
    parcelasRestantesMax:
      ativas.length > 0
        ? Math.max(...ativas.map((l) => l.parcelasRestantesPosContemplacao))
        : 0,
    prazoRestanteAposContemplacaoMax:
      ativas.length > 0
        ? Math.max(...ativas.map((l) => l.prazoRestanteAposContemplacao))
        : 0,
    parcelaPosContemplacaoMedia:
      ativas.length > 0
        ? ativas.reduce((a, l) => a + l.parcelaPosContemplacao, 0) / ativas.length
        : 0,
  };
}

export function formatPrazoGrupo(grupo: GrupoConsorcio): string {
  const p = calcularPrazoGrupoFromRow(grupo);
  const total = p.prazoTotal > 0 ? p.prazoTotal : (grupo.prazo_total ?? "—");
  return `${total} / ${p.prazoRestanteAtual} / ${p.parcelasRealizadasAtuais}`;
}

export function labelModalidadeParcelaLinha(
  config: Pick<ConfigLinhaSimulacaoGrupo, "modalidadeParcela" | "percentualParcelaPersonalizada">,
  grupo?: Pick<
    GrupoConsorcio,
    "percentual_parcela_reduzida" | "percentual_parcela_reduzida_personalizada"
  >,
): string {
  if (config.modalidadeParcela === "personalizada") {
    const pct =
      config.percentualParcelaPersonalizada ??
      grupo?.percentual_parcela_reduzida_personalizada ??
      null;
    return pct != null && pct > 0 ? `Personalizada (${pct}%)` : "Personalizada";
  }
  if (config.modalidadeParcela === "reduzida") {
    const pct = normalizarPercentualGrupo(grupo?.percentual_parcela_reduzida) || 60;
    return `Reduzida (${pct}%)`;
  }
  return "Integral";
}

export function defaultConfigLinha(
  grupo: GrupoConsorcio,
  cotas: GrupoCota[],
  modalidades: GrupoModalidadeLance[],
): ConfigLinhaSimulacaoGrupo {
  const mods = listarModalidadesLanceAtivas(grupo, modalidades);
  const umaMod = mods.length === 1 ? mods[0]! : null;
  const parcelaTipo = umaMod ? parcelaTipoFromModalidade(umaMod) : null;
  const pctEmb = umaMod ? num(umaMod.percentual_lance_embutido) : 0;
  return {
    cotaId: cotas[0]?.id ?? null,
    quantidadeCotas: 0,
    modalidadeParcela:
      parcelaTipo ?? (grupo.tem_parcela_reduzida ? "reduzida" : "integral"),
    percentualParcelaPersonalizada:
      grupo.percentual_parcela_reduzida_personalizada != null
        ? num(grupo.percentual_parcela_reduzida_personalizada)
        : null,
    usaLanceEmbutido: !!umaMod && pctEmb > 0,
    modalidadeLanceId: umaMod?.id ?? null,
    usaRecursoProprio: false,
    recursoProprioModo: "percentual",
    recursoProprioInput: num(grupo.percentual_recurso_proprio_sugerido),
    usaSeguro: grupoUsaSeguroNaParcela(grupo),
  };
}
