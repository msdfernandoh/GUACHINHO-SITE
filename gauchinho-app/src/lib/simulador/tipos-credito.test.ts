import { describe, expect, it } from "vitest";
import { DEFAULT_SIMULADOR_AUTOMOVEL, DEFAULT_SIMULADOR_IMOVEL } from "@/lib/config/defaults";
import {
  clampValorCreditoTipo,
  parseTipoBemFromQuery,
  resolveBemConfigSimulador,
} from "./tipos-credito";

const configs = { imovel: DEFAULT_SIMULADOR_IMOVEL, automovel: DEFAULT_SIMULADOR_AUTOMOVEL };

describe("tipos-credito simulador", () => {
  it("Moto mínimo 30000 e máximo 150000", () => {
    const cfg = resolveBemConfigSimulador("moto", configs);
    expect(cfg.valorMinimoCredito).toBe(30_000);
    expect(cfg.valorMaximoCredito).toBe(150_000);
  });

  it("Caminhões e Frota mínimo 100000 e máximo 1000000", () => {
    const cfg = resolveBemConfigSimulador("caminhoes_frota", configs);
    expect(cfg.valorMinimoCredito).toBe(100_000);
    expect(cfg.valorMaximoCredito).toBe(1_000_000);
  });

  it("caminhonete mapeia para caminhoes_frota na URL", () => {
    expect(parseTipoBemFromQuery("caminhonete")).toBe("caminhoes_frota");
    expect(parseTipoBemFromQuery("caminhoes_frota")).toBe("caminhoes_frota");
  });

  it("auto mapeia para automovel", () => {
    expect(parseTipoBemFromQuery("auto")).toBe("automovel");
    expect(parseTipoBemFromQuery("veiculo")).toBe("automovel");
  });

  it("ajusta valor acima do máximo de moto", () => {
    expect(clampValorCreditoTipo("moto", 200_000, configs)).toBe(150_000);
    expect(clampValorCreditoTipo("moto", 10_000, configs)).toBe(30_000);
  });
});
