import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import {
  calcularCreditoLiquidoPosContemplacao,
  calcularLanceEmbutidoLinha,
  calcularParcelasRestantes,
  calcularSaldoDevedorLinha,
  grupoToParametros,
  grupoUsaSeguroNaParcela,
  type ParametrosGrupo,
} from "./calculos";
import { fatorSeguroGrupo } from "./seguro";
import { calcularPrazoGrupoFromRow } from "./prazos";
import { parcelaTipoFromModalidade } from "./modalidades-admin";

export type ModalidadeParcelaLinha = "reduzida" | "integral";
export type RecursoProprioModo = "percentual" | "valor";

export type ConfigLinhaSimulacaoGrupo = {
  cotaId: string | null;
  quantidadeCotas: number;
  modalidadeParcela: ModalidadeParcelaLinha;
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
  /** Saldo após 1ª parcela (base da parcela pós-contemplação). */
  saldoDevedorFinal: number;
  primeiraParcela: number;
  parcelaBase: number;
  parcelaPosContemplacao: number;
  lanceEmbutido: number;
  recursoProprio: number;
  lanceTotal: number;
  seguroMensal: number;
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

  let base =
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
    parcelaPosContemplacao: 0,
    lanceEmbutido: 0,
    recursoProprio: 0,
    lanceTotal: 0,
    seguroMensal: 0,
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
  const saldoDevedorInicial = calcularSaldoDevedorLinha(
    somaCotas,
    params,
    cota.saldo_devedor,
    qty,
  );

  const modalidadesAtivas = listarModalidadesLanceAtivas(grupo, modalidades);
  const modLance = resolveModalidadeLance(config, modalidadesAtivas);
  const pctEmbutido = modLance && config.usaLanceEmbutido ? num(modLance.percentual_lance_embutido) : 0;
  const pctRecursoMin =
    modLance && config.usaLanceEmbutido ? num(modLance.percentual_recurso_proprio_minimo) : 0;
  const parcelaTipoLinha =
    (modLance && parcelaTipoFromModalidade(modLance)) || config.modalidadeParcela;

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

  const saldoUnit = qty > 0 ? saldoDevedorInicial / qty : 0;
  const fatorSeg = fatorSeguroGrupo(grupo.seguro_percentual);
  const seguroUnitario =
    config.usaSeguro && params.seguroHabilitado && fatorSeg > 0
      ? Math.round(saldoUnit * fatorSeg * 100) / 100
      : 0;

  const parcelaBase = parcelaMensalDaCota(
    cota,
    parcelaTipoLinha,
    grupo,
    config.usaSeguro,
    seguroUnitario,
  );
  const primeiraParcela = Math.round(parcelaBase * qty * 100) / 100;
  const seguroMensalExibicao =
    config.usaSeguro && params.seguroHabilitado && fatorSeg > 0
      ? Math.round(seguroUnitario * qty * 100) / 100
      : 0;

  const lanceTotal = lanceEmbutido + recursoProprio;
  const saldoPosLance = Math.max(
    0,
    Math.round((saldoDevedorInicial - lanceTotal) * 100) / 100,
  );
  const saldoDevedorFinal = Math.max(
    0,
    Math.round((saldoPosLance - primeiraParcela) * 100) / 100,
  );

  const prazoRestante = calcularParcelasRestantes(params);
  const parcelasRestantesPosContemplacao = Math.max(prazoRestante - 1, 1);
  const parcelaPosBase =
    Math.round((saldoDevedorFinal / parcelasRestantesPosContemplacao) * 100) / 100;
  const parcelaPosContemplacao =
    parcelaPosBase +
    (config.usaSeguro && params.seguroHabilitado ? seguroUnitario : 0);

  const creditoLiquido = calcularCreditoLiquidoPosContemplacao(somaCotas, lanceEmbutido);

  return {
    ativo: true,
    somaCotas,
    saldoDevedorInicial,
    saldoPosLance,
    saldoDevedorFinal,
    primeiraParcela,
    parcelaBase: Math.round((parcelaBase) * 100) / 100,
    parcelaPosContemplacao: Math.round(parcelaPosContemplacao * 100) / 100,
    lanceEmbutido,
    recursoProprio,
    lanceTotal,
    seguroMensal: Math.round(seguroMensalExibicao * 100) / 100,
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
  parcelaPosContemplacaoMedia: number;
} {
  const ativas = linhas.filter((l) => l.ativo);
  const totalCotas = ativas.reduce((acc, l) => acc + l.quantidadeCotas, 0);
  return {
    gruposSelecionados: ativas.length,
    totalCotas,
    somaCotas: ativas.reduce((a, l) => a + l.somaCotas, 0),
    primeiraParcela: ativas.reduce((a, l) => a + l.primeiraParcela, 0),
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
    usaLanceEmbutido: !!umaMod && pctEmb > 0,
    modalidadeLanceId: umaMod?.id ?? null,
    usaRecursoProprio: false,
    recursoProprioModo: "percentual",
    recursoProprioInput: num(grupo.percentual_recurso_proprio_sugerido),
    usaSeguro: grupoUsaSeguroNaParcela(grupo),
  };
}
