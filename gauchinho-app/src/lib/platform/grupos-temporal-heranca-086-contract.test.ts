import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calcularAssembleiasTemporal,
  resolveModalidadeConfig,
  type GrupoModalidadeItem,
  type AdministradoraModalidadeItem,
} from "./grupos-prontidao";

const migration086 = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/086_platform_grupos_assembleia_temporal_heranca.sql"),
  "utf8",
);

describe("Fase 086: Cálculo Temporal de Assembleias e Prazos do Grupo", () => {
  const primeiraAssembleia = "2026-02-15";
  const prazoTotal = 100;

  it("15/02/2026 + 100 meses, referência 14/08/2026 (dia anterior ao aniversário) -> 6 / 100 / 94", () => {
    const res = calcularAssembleiasTemporal(primeiraAssembleia, prazoTotal, "2026-08-14");
    expect(res.realizadas).toBe(6);
    expect(res.prazoTotal).toBe(100);
    expect(res.restantes).toBe(94);
    expect(res.resumoPrazo).toBe("6 / 100 / 94");
    expect(res.proximaAssembleia).toBe("2026-08-15");
    expect(res.encerrado).toBe(false);
  });

  it("15/02/2026 + 100 meses, referência 15/08/2026 (dia exato do aniversário) -> 7 / 100 / 93", () => {
    const res = calcularAssembleiasTemporal(primeiraAssembleia, prazoTotal, "2026-08-15");
    expect(res.realizadas).toBe(7);
    expect(res.prazoTotal).toBe(100);
    expect(res.restantes).toBe(93);
    expect(res.resumoPrazo).toBe("7 / 100 / 93");
    expect(res.proximaAssembleia).toBe("2026-09-15");
    expect(res.encerrado).toBe(false);
  });

  it("15/02/2026 + 100 meses, referência 16/08/2026 (dia após o aniversário) -> 7 / 100 / 93", () => {
    const res = calcularAssembleiasTemporal(primeiraAssembleia, prazoTotal, "2026-08-16");
    expect(res.realizadas).toBe(7);
    expect(res.prazoTotal).toBe(100);
    expect(res.restantes).toBe(93);
    expect(res.resumoPrazo).toBe("7 / 100 / 93");
    expect(res.proximaAssembleia).toBe("2026-09-15");
    expect(res.encerrado).toBe(false);
  });

  it("referência antes da primeira assembleia -> 0 / 100 / 100 e próxima assembleia = 1ª assembleia", () => {
    const res = calcularAssembleiasTemporal(primeiraAssembleia, prazoTotal, "2026-01-10");
    expect(res.realizadas).toBe(0);
    expect(res.prazoTotal).toBe(100);
    expect(res.restantes).toBe(100);
    expect(res.resumoPrazo).toBe("0 / 100 / 100");
    expect(res.proximaAssembleia).toBe("2026-02-15");
    expect(res.encerrado).toBe(false);
  });

  it("final do prazo -> 100 / 100 / 0 e status encerrado", () => {
    // 100 meses após 15/02/2026 = 15/05/2034
    const res = calcularAssembleiasTemporal(primeiraAssembleia, prazoTotal, "2035-01-01");
    expect(res.realizadas).toBe(100);
    expect(res.prazoTotal).toBe(100);
    expect(res.restantes).toBe(0);
    expect(res.resumoPrazo).toBe("100 / 100 / 0");
    expect(res.encerrado).toBe(true);
    expect(res.proximaAssembleia).toBeNull();
    expect(res.proximaAssembleiaFormatada).toBe("Encerrado");
  });

  it("nunca permite valores negativos ou realizadas > prazo total", () => {
    const resNegativo = calcularAssembleiasTemporal(null, -10, "2026-08-15");
    expect(resNegativo.realizadas).toBe(0);
    expect(resNegativo.prazoTotal).toBe(0);
    expect(resNegativo.restantes).toBe(0);

    const resOverflow = calcularAssembleiasTemporal("2020-01-01", 10, "2030-01-01");
    expect(resOverflow.realizadas).toBe(10);
    expect(resOverflow.restantes).toBe(0);
  });
});

describe("Fase 086: Herança e Override de Padrões de Modalidades da Administradora", () => {
  const adminModIntegral: AdministradoraModalidadeItem = {
    id: "mod-1",
    codigo: "INTEGRAL",
    nome: "Integral",
    ativo: true,
    modo_reduzido_padrao: "fixo",
    percentual_padrao: 100,
    percentual_minimo: 100,
    percentual_maximo: 100,
  };

  const adminModReduzida60: AdministradoraModalidadeItem = {
    id: "mod-2",
    codigo: "REDUZIDA_60_99",
    nome: "Reduzida 60% a 99%",
    ativo: true,
    modo_reduzido_padrao: "fixo",
    percentual_padrao: 60,
    percentual_minimo: 60,
    percentual_maximo: 99,
  };

  it("modalidade recém-habilitada no Grupo recebe e herda padrão oficial da Administradora", () => {
    const grupoMod: GrupoModalidadeItem = {
      administradora_modalidade_id: "mod-2",
      ativo: true,
      configuracao: {},
    };

    const resolved = resolveModalidadeConfig(grupoMod, adminModReduzida60);
    expect(resolved.ativo).toBe(true);
    expect(resolved.percentual_padrao).toBe(60);
    expect(resolved.percentual_minimo).toBe(60);
    expect(resolved.percentual_maximo).toBe(99);
    expect(resolved.modo_reduzido).toBe("fixo");
    expect(resolved.origem).toBe("ADMINISTRADORA_PADRAO");
    expect(resolved.labelOrigem).toBe("Padrão da Administradora");
    expect(resolved.isOverride).toBe(false);
  });

  it("override explícito do Grupo prevalece sobre o padrão da Administradora", () => {
    const grupoModOverride: GrupoModalidadeItem = {
      administradora_modalidade_id: "mod-2",
      ativo: true,
      configuracao: {
        origem: "GRUPO_OVERRIDE",
        percentual_padrao: 75,
        modo_reduzido: "personalizado",
        percentual_minimo: 70,
        percentual_maximo: 80,
      },
    };

    const resolved = resolveModalidadeConfig(grupoModOverride, adminModReduzida60);
    expect(resolved.percentual_padrao).toBe(75);
    expect(resolved.percentual_minimo).toBe(70);
    expect(resolved.percentual_maximo).toBe(80);
    expect(resolved.modo_reduzido).toBe("personalizado");
    expect(resolved.origem).toBe("GRUPO_OVERRIDE");
    expect(resolved.labelOrigem).toBe("Personalizado neste Grupo");
    expect(resolved.isOverride).toBe(true);
  });

  it("ao retirar o override ou marcar uso de padrão, volta a herdar o padrão da Administradora", () => {
    const grupoModReset: GrupoModalidadeItem = {
      administradora_modalidade_id: "mod-2",
      ativo: true,
      configuracao: {
        origem: "ADMINISTRADORA_PADRAO",
        percentual_padrao: 60,
      },
    };

    const resolved = resolveModalidadeConfig(grupoModReset, adminModReduzida60);
    expect(resolved.percentual_padrao).toBe(60);
    expect(resolved.origem).toBe("ADMINISTRADORA_PADRAO");
    expect(resolved.labelOrigem).toBe("Padrão da Administradora");
    expect(resolved.isOverride).toBe(false);
  });

  it("modalidade Integral padrão herda 100% fixo", () => {
    const resolved = resolveModalidadeConfig(undefined, adminModIntegral);
    expect(resolved.percentual_padrao).toBe(100);
    expect(resolved.modo_reduzido).toBe("fixo");
    expect(resolved.origem).toBe("ADMINISTRADORA_PADRAO");
  });
});

describe("Fase 086: Migration 086 e Contrato de Banco de Dados", () => {
  it("adiciona data_primeira_assembleia em grupos_consorcio", () => {
    expect(migration086).toContain("ADD COLUMN IF NOT EXISTS data_primeira_assembleia date");
  });

  it("adiciona colunas de padrão em administradora_modalidades_comissao", () => {
    expect(migration086).toContain("modo_reduzido_padrao text DEFAULT 'fixo'");
    expect(migration086).toContain("percentual_padrao numeric");
    expect(migration086).toContain("percentual_minimo numeric");
    expect(migration086).toContain("percentual_maximo numeric");
  });

  it("atualiza rpc_platform_salvar_grupo para receber p_data_primeira_assembleia", () => {
    expect(migration086).toContain("p_data_primeira_assembleia date DEFAULT NULL");
    expect(migration086).toContain("data_primeira_assembleia = p_data_primeira_assembleia");
  });

  it("popula padrões oficiais para INTEGRAL, REDUZIDA_60_99 e REDUZIDA_ABAIXO_59", () => {
    expect(migration086).toContain("WHERE codigo = 'INTEGRAL'");
    expect(migration086).toContain("WHERE codigo = 'REDUZIDA_60_99'");
    expect(migration086).toContain("WHERE codigo = 'REDUZIDA_ABAIXO_59'");
  });
});
