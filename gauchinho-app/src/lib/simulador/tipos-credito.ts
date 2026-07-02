import type { SimuladorTipoBemConfig } from "@/lib/config/defaults";
import type { SimuladorConfigs } from "@/components/simulador/simulador-types";

export type TipoBemSimulador = "imovel" | "automovel" | "moto" | "caminhoes_frota";

export const TIPO_BEM_LABEL: Record<TipoBemSimulador, string> = {
  imovel: "Imóvel",
  automovel: "Veículo",
  moto: "Moto",
  caminhoes_frota: "Caminhões e Frota",
};

const LIMITES: Record<
  "moto" | "caminhoes_frota",
  { min: number; max: number; padrao: number }
> = {
  moto: { min: 30_000, max: 150_000, padrao: 50_000 },
  caminhoes_frota: { min: 100_000, max: 1_000_000, padrao: 300_000 },
};

/** Normaliza query `tipo` da URL para id interno do simulador. */
export function parseTipoBemFromQuery(raw: string | undefined): TipoBemSimulador | undefined {
  if (!raw) return undefined;
  const t = raw.trim().toLowerCase().replace(/-/g, "_");
  if (t === "imovel" || t === "imóvel") return "imovel";
  if (t === "veiculo" || t === "veículo" || t === "auto" || t === "automovel" || t === "automóvel" || t === "carro") {
    return "automovel";
  }
  if (t === "moto") return "moto";
  if (t === "caminhonete" || t === "caminhoes_frota" || t === "caminhoes" || t === "frota") {
    return "caminhoes_frota";
  }
  if (t === "imovel") return "imovel";
  return undefined;
}

export function clampValorCreditoTipo(tipo: TipoBemSimulador, valor: number, configs: SimuladorConfigs): number {
  const cfg = resolveBemConfigSimulador(tipo, configs);
  return Math.min(cfg.valorMaximoCredito, Math.max(cfg.valorMinimoCredito, valor));
}

/** Config de consórcio (taxas/prazos) + limites de valor por tipo. */
export function resolveBemConfigSimulador(
  tipo: TipoBemSimulador,
  configs: SimuladorConfigs,
): SimuladorTipoBemConfig {
  const base = tipo === "imovel" ? configs.imovel : configs.automovel;
  if (tipo === "moto") {
    const l = LIMITES.moto;
    return {
      ...base,
      valorMinimoCredito: l.min,
      valorMaximoCredito: l.max,
      valorPadraoInicial: l.padrao,
    };
  }
  if (tipo === "caminhoes_frota") {
    const l = LIMITES.caminhoes_frota;
    return {
      ...base,
      valorMinimoCredito: l.min,
      valorMaximoCredito: l.max,
      valorPadraoInicial: l.padrao,
    };
  }
  return base;
}

export function limitesTipo(tipo: TipoBemSimulador): { min: number; max: number } | null {
  if (tipo === "moto") return { min: LIMITES.moto.min, max: LIMITES.moto.max };
  if (tipo === "caminhoes_frota") return { min: LIMITES.caminhoes_frota.min, max: LIMITES.caminhoes_frota.max };
  return null;
}
