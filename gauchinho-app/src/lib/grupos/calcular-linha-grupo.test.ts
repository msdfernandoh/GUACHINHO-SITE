import { describe, expect, it } from "vitest";
import {
  calcularLinhaSimulacaoGrupo,
  type ConfigLinhaSimulacaoGrupo,
} from "./simulacao-linha";
import type { GrupoConsorcio, GrupoCota } from "@/lib/types";

function grupoFixture(overrides: Partial<GrupoConsorcio> = {}): GrupoConsorcio {
  return {
    id: "g-test",
    codigo_grupo: "1513",
    modalidade: "Imóvel",
    administradora: "Test",
    taxa_administrativa_percentual: 22,
    fundo_reserva_percentual: 2,
    seguro_habilitado: false,
    seguro_percentual: null,
    seguro_valor: null,
    tem_parcela_reduzida: true,
    percentual_parcela_reduzida: 60,
    permite_lance_embutido: true,
    percentual_lance_embutido: 25,
    percentual_recurso_proprio_sugerido: 10,
    prazo_total: 220,
    parcelas_realizadas: 0,
    prazo_restante: 220,
    parcelas_realizadas_base: null,
    data_base_parcelas: null,
    atualizacao_parcelas_automatica: false,
    seguro_pos_contemplacao: false,
    cet_percentual: null,
    status: "Disponível",
    ativo: true,
    observacoes: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function cotaFixture(overrides: Partial<GrupoCota> = {}): GrupoCota {
  return {
    id: "c1",
    grupo_id: "g-test",
    valor_credito: 1_050_000,
    valor_parcela: 2863.64,
    parcela_integral: 4772.73,
    parcela_reduzida: 2863.64,
    parcela_com_seguro: null,
    parcela_sem_seguro: null,
    saldo_devedor: 1_050_000,
    vagas_percentual: null,
    vagas_texto: null,
    status: "Disponível",
    ativo: true,
    ordem: 0,
    ...overrides,
  };
}

function configBase(
  overrides: Partial<ConfigLinhaSimulacaoGrupo> = {},
): ConfigLinhaSimulacaoGrupo {
  return {
    cotaId: "c1",
    quantidadeCotas: 1,
    modalidadeParcela: "reduzida",
    usaLanceEmbutido: false,
    modalidadeLanceId: null,
    usaRecursoProprio: false,
    recursoProprioModo: "percentual",
    recursoProprioInput: 0,
    usaSeguro: false,
    percentualParcelaPersonalizada: null,
    ...overrides,
  };
}

const mod25 = {
  id: "m25",
  grupo_id: "g-test",
  nome: "25% embutido",
  percentual_lance_embutido: 25,
  percentual_recurso_proprio_minimo: 10,
  descricao: null,
  ativo: true,
  ordem: 0,
  created_at: "",
  updated_at: "",
};

describe("calcularLinhaSimulacaoGrupo — saldo e parcelas", () => {
  it("caso 1 — sem embutido", () => {
    const r = calcularLinhaSimulacaoGrupo({
      grupo: grupoFixture(),
      cota: cotaFixture(),
      modalidades: [],
      config: configBase({ usaLanceEmbutido: false }),
    });
    expect(r.saldoDevedorInicial).toBe(1_302_000);
    expect(r.parcelaIntegral).toBeCloseTo(5918.18, 1);
    expect(r.parcelaReduzida).toBeCloseTo(3550.91, 1);
    expect(r.lanceEmbutido).toBe(0);
    expect(r.creditoLiquido).toBe(1_050_000);
    expect(r.saldoPosLance).toBe(1_302_000);
  });

  it("caso 2 — embutido 25%", () => {
    const r = calcularLinhaSimulacaoGrupo({
      grupo: grupoFixture(),
      cota: cotaFixture(),
      modalidades: [mod25],
      config: configBase({
        usaLanceEmbutido: true,
        modalidadeLanceId: "m25",
      }),
    });
    expect(r.saldoDevedorInicial).toBe(1_302_000);
    expect(r.parcelaIntegral).toBeCloseTo(5918.18, 1);
    expect(r.parcelaReduzida).toBeCloseTo(3550.91, 1);
    expect(r.lanceEmbutido).toBe(325_500);
    expect(r.lanceTotal).toBe(325_500);
    expect(r.creditoLiquido).toBe(724_500);
    expect(r.saldoPosLance).toBe(976_500);
    expect(r.parcelaPosContemplacao).toBeCloseTo(4442.69, 1);
  });

  it("caso 3 — embutido 25% + próprio 10%", () => {
    const r = calcularLinhaSimulacaoGrupo({
      grupo: grupoFixture(),
      cota: cotaFixture(),
      modalidades: [mod25],
      config: configBase({
        usaLanceEmbutido: true,
        modalidadeLanceId: "m25",
        usaRecursoProprio: true,
        recursoProprioModo: "percentual",
        recursoProprioInput: 10,
      }),
    });
    expect(r.recursoProprio).toBe(130_200);
    expect(r.lanceTotal).toBe(455_700);
    expect(r.creditoLiquido).toBe(724_500);
    expect(r.saldoPosLance).toBe(846_300);
  });

  it("parcela personalizada usa percentual informado na linha", () => {
    const r = calcularLinhaSimulacaoGrupo({
      grupo: grupoFixture({
        permite_parcela_reduzida_personalizada: true,
        percentual_parcela_reduzida_personalizada: 40,
      }),
      cota: cotaFixture(),
      modalidades: [],
      config: configBase({
        modalidadeParcela: "personalizada",
        percentualParcelaPersonalizada: 40,
      }),
    });
    expect(r.parcelaIntegral).toBeCloseTo(5918.18, 1);
    expect(r.parcelaPersonalizada).toBeCloseTo(2367.27, 1);
    expect(r.parcelaBase).toBeCloseTo(2367.27, 1);
  });
});
