import { createHash } from "node:crypto";
import {
  agregarResultadosLinhas,
  calcularLinhaSimulacaoGrupo,
  defaultConfigLinha,
  type ConfigLinhaSimulacaoGrupo,
} from "@/lib/grupos/simulacao-linha";
import { assertSelecoesAutorizadasForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { buildDadosSimulacaoGrupos } from "./build-grupos-payload";
import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";

export const VERSAO_MOTOR_CALCULO_GRUPOS = "grupos-site-v1";

type SnapshotCalculo = {
  versao_motor: string;
  hash_sha256: string;
  gerado_em: string;
  origem: "SITE";
  imutavel: true;
};

type DadosComSnapshot = Record<string, unknown> & {
  snapshot_calculo: SnapshotCalculo;
};

type CatalogoResolvido = {
  grupos: Map<string, GrupoConsorcio>;
  cotas: Map<string, GrupoCota>;
  modalidades: Map<string, GrupoModalidadeLance[]>;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finite(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  return Object.keys(input)
    .sort()
    .reduce<Record<string, unknown>>((out, key) => {
      out[key] = stableValue(input[key]);
      return out;
    }, {});
}

function dadosComerciaisAssinados(dados: Record<string, unknown>) {
  return {
    selecoes: dados.selecoes,
    totais: dados.totais,
    modalidadeResumo: dados.modalidadeResumo,
    creditoLiquidoTotal: dados.creditoLiquidoTotal,
    primeiraParcelaTotal: dados.primeiraParcelaTotal,
    valor_credito: dados.valor_credito,
    valor_parcela: dados.valor_parcela,
    prazo: dados.prazo,
  };
}

export function calcularHashSnapshotGrupos(dados: Record<string, unknown>): string {
  const canonical = JSON.stringify(stableValue(dadosComerciaisAssinados(dados)));
  return createHash("sha256").update(canonical).digest("hex");
}

function normalizarConfig(
  rawValue: unknown,
  grupo: GrupoConsorcio,
  cota: GrupoCota,
  modalidades: GrupoModalidadeLance[],
): ConfigLinhaSimulacaoGrupo {
  const raw = object(rawValue);
  const base = defaultConfigLinha(grupo, [cota], modalidades);
  const modalidadeInformada = String(raw.modalidadeParcela ?? base.modalidadeParcela);
  const modalidadeParcela =
    modalidadeInformada === "integral" ||
    modalidadeInformada === "reduzida" ||
    modalidadeInformada === "personalizada"
      ? modalidadeInformada
      : base.modalidadeParcela;
  const quantidadeCotas = Math.floor(finite(raw.quantidadeCotas, 0));
  if (quantidadeCotas < 1 || quantidadeCotas > 1_000) {
    throw new Error("Quantidade de cotas inválida para a contratação.");
  }

  const recursoProprioModo = raw.recursoProprioModo === "valor" ? "valor" : "percentual";
  const recursoProprioInput = finite(raw.recursoProprioInput, base.recursoProprioInput);
  if (recursoProprioInput < 0) throw new Error("Recurso próprio não pode ser negativo.");
  if (recursoProprioModo === "percentual" && recursoProprioInput > 100) {
    throw new Error("Percentual de recurso próprio inválido.");
  }

  const modalidadeLanceId = raw.modalidadeLanceId
    ? String(raw.modalidadeLanceId)
    : base.modalidadeLanceId;
  const idsPermitidos = new Set(modalidades.filter((item) => item.ativo).map((item) => item.id));
  const fallbackPermitido =
    modalidades.length === 0 && modalidadeLanceId === `fallback-${grupo.id}`;
  if (modalidadeLanceId && !idsPermitidos.has(modalidadeLanceId) && !fallbackPermitido) {
    throw new Error("Modalidade de lance não pertence ao grupo selecionado.");
  }

  const percentualPersonalizado =
    raw.percentualParcelaPersonalizada == null
      ? base.percentualParcelaPersonalizada
      : finite(raw.percentualParcelaPersonalizada, 0);
  if (
    modalidadeParcela === "personalizada" &&
    (percentualPersonalizado == null || percentualPersonalizado <= 0 || percentualPersonalizado > 100)
  ) {
    throw new Error("Percentual da parcela personalizada inválido.");
  }

  return {
    cotaId: cota.id,
    quantidadeCotas,
    modalidadeParcela,
    percentualParcelaPersonalizada: percentualPersonalizado,
    usaLanceEmbutido: bool(raw.usaLanceEmbutido, base.usaLanceEmbutido),
    modalidadeLanceId,
    usaRecursoProprio: bool(raw.usaRecursoProprio, base.usaRecursoProprio),
    recursoProprioModo,
    recursoProprioInput,
    usaSeguro: bool(raw.usaSeguro, base.usaSeguro),
  };
}

export function canonicalizarDadosSimulacaoGruposComCatalogo(
  dadosRecebidos: Record<string, unknown>,
  catalogo: CatalogoResolvido,
  agora = new Date(),
): DadosComSnapshot {
  const selecoes = Array.isArray(dadosRecebidos.selecoes) ? dadosRecebidos.selecoes : [];
  if (!selecoes.length || selecoes.length > 50) {
    throw new Error("Seleção de grupos inválida para a contratação.");
  }

  const linhas = selecoes.map((rawValue) => {
    const raw = object(rawValue);
    const grupoId = String(raw.grupoId ?? object(raw.grupo).id ?? "").trim();
    const cotaId = String(raw.cotaId ?? object(raw.cota).id ?? "").trim();
    const grupo = catalogo.grupos.get(grupoId);
    const cota = catalogo.cotas.get(cotaId);
    if (!grupo || !cota || cota.grupo_id !== grupo.id) {
      throw new Error("Grupo ou produto comercial não autorizado.");
    }
    const modalidades = catalogo.modalidades.get(grupo.id) ?? [];
    const config = normalizarConfig(raw.config, grupo, cota, modalidades);
    const resultado = calcularLinhaSimulacaoGrupo({ grupo, cota, config, modalidades });
    if (!resultado.ativo || resultado.primeiraParcela <= 0 || resultado.somaCotas <= 0) {
      throw new Error("Não foi possível validar o cálculo comercial da proposta.");
    }
    return { grupoId: grupo.id, cotaId: cota.id, grupo, modalidades, config, resultado };
  });

  const totais = agregarResultadosLinhas(linhas.map((linha) => linha.resultado));
  const base = buildDadosSimulacaoGrupos(linhas, totais) as Record<string, unknown>;
  const prazo = linhas.reduce((maior, linha) => {
    const atual = Number(linha.grupo.prazo_restante ?? linha.grupo.prazo_total ?? 0);
    return Number.isFinite(atual) ? Math.max(maior, Math.round(atual)) : maior;
  }, 0);
  const canonical: Record<string, unknown> = {
    ...base,
    valor_credito: totais.somaCotas,
    valor_parcela: totais.primeiraParcela,
    prazo: prazo || null,
  };
  return {
    ...canonical,
    snapshot_calculo: {
      versao_motor: VERSAO_MOTOR_CALCULO_GRUPOS,
      hash_sha256: calcularHashSnapshotGrupos(canonical),
      gerado_em: agora.toISOString(),
      origem: "SITE",
      imutavel: true,
    },
  };
}

export async function canonicalizarDadosSimulacaoGrupos(
  empresaId: string,
  dadosRecebidos: Record<string, unknown>,
): Promise<DadosComSnapshot> {
  const selecoes = Array.isArray(dadosRecebidos.selecoes) ? dadosRecebidos.selecoes : [];
  const ids = selecoes.map((item) => {
    const raw = object(item);
    return {
      grupoId: String(raw.grupoId ?? object(raw.grupo).id ?? "").trim(),
      cotaId: String(raw.cotaId ?? object(raw.cota).id ?? "").trim(),
    };
  });
  const catalogo = await assertSelecoesAutorizadasForEmpresa(empresaId, ids);
  return canonicalizarDadosSimulacaoGruposComCatalogo(dadosRecebidos, catalogo);
}

export function assertSnapshotCalculoGruposIntegro(dados: Record<string, unknown>): void {
  const snapshot = object(dados.snapshot_calculo);
  if (!snapshot.hash_sha256) return; // Compatibilidade explícita com propostas legadas.
  if (snapshot.versao_motor !== VERSAO_MOTOR_CALCULO_GRUPOS || snapshot.imutavel !== true) {
    throw new Error("Versão do cálculo comercial não reconhecida.");
  }
  const esperado = calcularHashSnapshotGrupos(dados);
  if (snapshot.hash_sha256 !== esperado) {
    throw new Error("Os valores aceitos na proposta foram alterados. Gere uma nova proposta.");
  }
}
