import type { FinanciamentoConfig } from "@/lib/config/defaults";
import { DEFAULT_FINANCIAMENTO_CONFIG } from "@/lib/config/defaults";

export type FinanciamentoTipoConfig = {
  taxaMensalPercentual: number;
  taxaAnualPercentual?: number;
  entradaPercentualPadrao: number;
  prazosDisponiveis: number[];
  prazoPadrao: number;
  prazoMaximo: number;
  parceiroPadrao: string;
  mostrarComparacaoComConsorcio: boolean;
  indiceReajusteOpcional?: number;
};

export type FinanciamentoConfigStored = {
  imovel: FinanciamentoTipoConfig;
  veiculo: FinanciamentoTipoConfig;
};

const DEFAULT_IMOVEL: FinanciamentoTipoConfig = {
  taxaMensalPercentual: 1.1,
  taxaAnualPercentual: 0,
  entradaPercentualPadrao: 20,
  prazosDisponiveis: [120, 180, 220, 240, 300, 360, 420],
  prazoPadrao: 240,
  prazoMaximo: 420,
  parceiroPadrao: "",
  mostrarComparacaoComConsorcio: true,
  indiceReajusteOpcional: 0,
};

const DEFAULT_VEICULO: FinanciamentoTipoConfig = {
  taxaMensalPercentual: 1.8,
  taxaAnualPercentual: 0,
  entradaPercentualPadrao: 0,
  prazosDisponiveis: [24, 36, 48, 60, 72],
  prazoPadrao: 60,
  prazoMaximo: 72,
  parceiroPadrao: "",
  mostrarComparacaoComConsorcio: true,
  indiceReajusteOpcional: 0,
};

function legacyFlatToTipo(flat: FinanciamentoConfig): FinanciamentoTipoConfig {
  return {
    taxaMensalPercentual: flat.taxaMensalPadrao,
    entradaPercentualPadrao: flat.entradaMinimaSugeridaPercentual,
    prazosDisponiveis: flat.prazosDisponiveis ?? [],
    prazoPadrao: flat.prazoPadrao,
    prazoMaximo: flat.prazoMaximo,
    parceiroPadrao: flat.parceiroPadrao,
    mostrarComparacaoComConsorcio: flat.mostrarComparacaoConsorcio,
    indiceReajusteOpcional: flat.indiceReajusteOpcional,
  };
}

function mergeTipo(
  base: FinanciamentoTipoConfig,
  partial?: Partial<FinanciamentoTipoConfig> | null,
): FinanciamentoTipoConfig {
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    prazosDisponiveis: partial.prazosDisponiveis?.length
      ? partial.prazosDisponiveis
      : base.prazosDisponiveis,
  };
}

/** Normaliza JSON do banco (legado flat ou imovel/veiculo). */
export function normalizeFinanciamentoStored(raw: unknown): FinanciamentoConfigStored {
  const r = raw as Record<string, unknown> | null | undefined;
  if (r && typeof r === "object" && ("imovel" in r || "veiculo" in r)) {
    return {
      imovel: mergeTipo(DEFAULT_IMOVEL, r.imovel as Partial<FinanciamentoTipoConfig>),
      veiculo: mergeTipo(DEFAULT_VEICULO, r.veiculo as Partial<FinanciamentoTipoConfig>),
    };
  }
  const flat = { ...DEFAULT_FINANCIAMENTO_CONFIG, ...(r as FinanciamentoConfig) };
  const fromFlat = legacyFlatToTipo(flat);
  return {
    imovel: mergeTipo(DEFAULT_IMOVEL, fromFlat),
    veiculo: mergeTipo(DEFAULT_VEICULO, {
      ...fromFlat,
      prazosDisponiveis: DEFAULT_VEICULO.prazosDisponiveis,
      prazoPadrao: DEFAULT_VEICULO.prazoPadrao,
      prazoMaximo: DEFAULT_VEICULO.prazoMaximo,
      taxaMensalPercentual:
        flat.taxaMensalPadrao !== DEFAULT_FINANCIAMENTO_CONFIG.taxaMensalPadrao
          ? flat.taxaMensalPadrao
          : DEFAULT_VEICULO.taxaMensalPercentual,
    }),
  };
}

export type TipoFinanciamentoBem = "imovel" | "veiculo";

/** Normaliza texto ou slug de tipo de bem para config de financiamento. */
export function normalizeTipoFinanciamento(
  input: string | "imovel" | "automovel" | "moto" | "caminhoes_frota" | "caminhonete",
): TipoFinanciamentoBem {
  const t = String(input).trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (t === "imovel" || t === "casa" || t === "apartamento") return "imovel";
  if (
    t === "veiculo" ||
    t === "auto" ||
    t === "automovel" ||
    t === "carro" ||
    t === "carros" ||
    t === "moto" ||
    t === "caminhonete" ||
    t === "caminhoes_frota" ||
    t === "caminhoes" ||
    t === "frota"
  ) {
    return "veiculo";
  }
  return t === "imovel" ? "imovel" : "veiculo";
}

export function tipoFinanciamentoFromBem(
  tipo: "imovel" | "automovel" | "moto" | "caminhoes_frota" | "caminhonete",
): TipoFinanciamentoBem {
  return normalizeTipoFinanciamento(tipo);
}

/** Converte config por tipo para o formato usado pelo simulador/prazos. */
export function financiamentoConfigParaTipo(
  stored: FinanciamentoConfigStored,
  tipo: TipoFinanciamentoBem,
): FinanciamentoConfig {
  const t = tipo === "veiculo" ? stored.veiculo : stored.imovel;
  return {
    taxaMensalPadrao: t.taxaMensalPercentual,
    entradaMinimaSugeridaPercentual: t.entradaPercentualPadrao,
    prazoPadrao: t.prazoPadrao,
    prazoMaximo: t.prazoMaximo,
    prazosDisponiveis: t.prazosDisponiveis,
    indiceReajusteOpcional: t.indiceReajusteOpcional ?? 0,
    parceiroPadrao: t.parceiroPadrao,
    mostrarComparacaoConsorcio: t.mostrarComparacaoComConsorcio,
  };
}

export { DEFAULT_IMOVEL as DEFAULT_FINANCIAMENTO_IMOVEL, DEFAULT_VEICULO as DEFAULT_FINANCIAMENTO_VEICULO };
