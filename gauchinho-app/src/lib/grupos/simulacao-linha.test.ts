import { describe, expect, it } from "vitest";
import { fatorSeguroGrupo, parseSeguroInput } from "./seguro";
import {
  agregarResultadosLinhas,
  calcularPosContemplacaoPorTipo,
  calcularLinhaSimulacaoGrupo,
  formatPrazoGrupo,
} from "./simulacao-linha";
import type { GrupoConsorcio, GrupoCota } from "@/lib/types";

const grupoBase: GrupoConsorcio = {
  id: "g1",
  codigo_grupo: "1533",
  modalidade: "Imóvel",
  administradora: null,
  taxa_administrativa_percentual: 20,
  fundo_reserva_percentual: 2,
  seguro_habilitado: true,
  seguro_percentual: 0.0004,
  seguro_valor: null,
  tem_parcela_reduzida: true,
  percentual_parcela_reduzida: 50,
  permite_lance_embutido: true,
  percentual_lance_embutido: 25,
  percentual_recurso_proprio_sugerido: 0,
  prazo_total: 220,
  parcelas_realizadas: 11,
  prazo_restante: 209,
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
};

const cota: GrupoCota = {
  id: "c1",
  grupo_id: "g1",
  valor_credito: 750_000,
  valor_parcela: 3000,
  parcela_integral: 6000,
  parcela_reduzida: 3000,
  parcela_com_seguro: 3100,
  parcela_sem_seguro: 6000,
  saldo_devedor: 623_483.33,
  vagas_percentual: null,
  vagas_texto: null,
  status: "Disponível",
  ativo: true,
  ordem: 0,
};

describe("seguro grupos", () => {
  it("fator decimal 0,0004", () => {
    expect(fatorSeguroGrupo(0.0004)).toBeCloseTo(0.0004);
    expect(parseSeguroInput("0,0004")).toBeCloseTo(0.0004);
  });

  it("0,04 significa 0,04% a.m. (planilha)", () => {
    expect(fatorSeguroGrupo(0.04)).toBeCloseTo(0.0004);
    expect(fatorSeguroGrupo(0.038)).toBeCloseTo(0.00038);
  });

  it("legado percentual >= 0.1", () => {
    expect(fatorSeguroGrupo(1)).toBeCloseTo(0.01);
  });
});

describe("simulacao linha grupo", () => {
  it("reproduz o prazo restante de imóvel sem descontar a 1ª parcela na nova parcela", () => {
    const resultado = calcularPosContemplacaoPorTipo({
      tipo: "imovel",
      saldoDevedor: 562_500,
      lanceTotal: 281_250,
      primeiraParcela: 1_759.09,
      parcelasARealizar: 210,
    });

    expect(resultado.parcelaPosContemplacao).toBeCloseTo(281_250 / 209, 10);
    expect(resultado.prazoRestanteAposContemplacao).toBeCloseTo(
      (562_500 - 281_250 - 1_759.09) / (281_250 / 209),
      10,
    );
  });

  it("reproduz o piso de 0,7% e o prazo restante de veículo", () => {
    const resultado = calcularPosContemplacaoPorTipo({
      tipo: "veiculo",
      saldoDevedor: 116_000,
      lanceTotal: 82_360,
      primeiraParcela: 626.4,
      parcelasARealizar: 114,
    });

    expect(resultado.parcelaPosContemplacao).toBe(812);
    expect(resultado.prazoRestanteAposContemplacao).toBeCloseTo(
      (116_000 - 82_360 - 626.4) / 812,
      10,
    );
  });

  it("soma cotas = crédito × qtd", () => {
    const r = calcularLinhaSimulacaoGrupo({
      grupo: grupoBase,
      cota,
      modalidades: [],
      config: {
        cotaId: cota.id,
        quantidadeCotas: 6,
        modalidadeParcela: "reduzida",
        usaLanceEmbutido: false,
        modalidadeLanceId: null,
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: false,
        percentualParcelaPersonalizada: null,
      },
    });
    expect(r.ativo).toBe(true);
    expect(r.somaCotas).toBe(4_500_000);
  });

  it("seguro mensal pós sobre saldo após lance e 1ª parcela (não o saldo cheio)", () => {
    const r = calcularLinhaSimulacaoGrupo({
      grupo: grupoBase,
      cota,
      modalidades: [],
      config: {
        cotaId: cota.id,
        quantidadeCotas: 1,
        modalidadeParcela: "integral",
        usaLanceEmbutido: false,
        modalidadeLanceId: null,
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: true,
        percentualParcelaPersonalizada: null,
      },
    });
    const saldoEsperado = 750_000 * 1.22;
    expect(r.saldoDevedorInicial).toBeCloseTo(saldoEsperado, 0);
    // Sem lance: seguro ≈ (saldo − 1ª sem seguro) × 0,0004
    expect(r.seguroMensal).toBeCloseTo(r.saldoDevedorFinal * 0.0004, 1);
    expect(r.seguroMensal).toBeLessThan(saldoEsperado * 0.0004 + 0.02);
  });

  it("usa exclusivamente a taxa cadastrada no grupo nas opções com e sem seguro", () => {
    const grupo = {
      ...grupoBase,
      seguro_habilitado: false,
      seguro_pos_contemplacao: false,
      seguro_percentual: 0.0007,
    };
    const config = {
      cotaId: cota.id,
      quantidadeCotas: 1,
      modalidadeParcela: "integral" as const,
      usaLanceEmbutido: false,
      modalidadeLanceId: null,
      usaRecursoProprio: false,
      recursoProprioModo: "percentual" as const,
      recursoProprioInput: 0,
      percentualParcelaPersonalizada: null,
    };
    const semSeguro = calcularLinhaSimulacaoGrupo({
      grupo,
      cota,
      modalidades: [],
      config: { ...config, usaSeguro: false },
    });
    const comSeguro = calcularLinhaSimulacaoGrupo({
      grupo,
      cota,
      modalidades: [],
      config: { ...config, usaSeguro: true },
    });

    expect(comSeguro.seguroPrimeiraParcela).toBeCloseTo(
      comSeguro.saldoDevedorInicial * 0.0007,
      2,
    );
    expect(comSeguro.primeiraParcela - semSeguro.primeiraParcela).toBeCloseTo(
      comSeguro.seguroPrimeiraParcela,
      2,
    );
  });

  it("parcela pós inclui seguro mesmo com usaSeguro=false; seguro cai com o lance", () => {
    const cfgBase = {
      cotaId: cota.id,
      quantidadeCotas: 1,
      modalidadeParcela: "integral" as const,
      modalidadeLanceId: null,
      usaRecursoProprio: false,
      recursoProprioModo: "percentual" as const,
      recursoProprioInput: 0,
      percentualParcelaPersonalizada: null,
    };
    const semLance = calcularLinhaSimulacaoGrupo({
      grupo: grupoBase,
      cota,
      modalidades: [
        {
          id: "m25",
          grupo_id: grupoBase.id,
          nome: "25% embutido",
          percentual_lance_embutido: 25,
          percentual_recurso_proprio_minimo: 0,
          descricao: null,
          ativo: true,
          ordem: 0,
          created_at: "",
          updated_at: "",
        },
      ],
      config: {
        ...cfgBase,
        usaLanceEmbutido: false,
        usaSeguro: false,
      },
    });
    const com25 = calcularLinhaSimulacaoGrupo({
      grupo: grupoBase,
      cota,
      modalidades: [
        {
          id: "m25",
          grupo_id: grupoBase.id,
          nome: "25% embutido",
          percentual_lance_embutido: 25,
          percentual_recurso_proprio_minimo: 0,
          descricao: null,
          ativo: true,
          ordem: 0,
          created_at: "",
          updated_at: "",
        },
      ],
      config: {
        ...cfgBase,
        usaLanceEmbutido: true,
        modalidadeLanceId: "m25",
        usaSeguro: false,
      },
    });
    expect(semLance.seguroMensal).toBeGreaterThan(0);
    expect(com25.seguroMensal).toBeGreaterThan(0);
    expect(com25.seguroMensal).toBeLessThan(semLance.seguroMensal);
    const saldoFormula = cota.valor_credito! * 1.2;
    expect(com25.parcelaPosContemplacao).toBeCloseTo(
      (saldoFormula - com25.lanceTotal) / ((grupoBase.prazo_restante ?? 209) - 1),
      10,
    );
  });

  it("imóvel 1533: lance 25% → parcela pós sem descontar a 1ª parcela", () => {
    // Planilha: prazo 220, reduzida 60%, saldo 1.860.000, lance 25%
    const g24: GrupoConsorcio = {
      ...grupoBase,
      taxa_administrativa_percentual: 24,
      fundo_reserva_percentual: 0,
      prazo_total: 220,
      parcelas_realizadas: 11,
      prazo_restante: 209,
      percentual_parcela_reduzida: 60,
      tem_parcela_reduzida: true,
      seguro_percentual: 0.0004,
    };
    const cota15: GrupoCota = {
      ...cota,
      id: "c15",
      valor_credito: 1_500_000,
      saldo_devedor: null as unknown as number,
    };
    const r = calcularLinhaSimulacaoGrupo({
      grupo: g24,
      cota: cota15,
      modalidades: [
        {
          id: "m25",
          grupo_id: g24.id,
          nome: "25%",
          percentual_lance_embutido: 25,
          percentual_recurso_proprio_minimo: 0,
          descricao: null,
          ativo: true,
          ordem: 0,
          created_at: "",
          updated_at: "",
        },
      ],
      config: {
        cotaId: cota15.id,
        quantidadeCotas: 1,
        modalidadeParcela: "reduzida",
        usaLanceEmbutido: true,
        modalidadeLanceId: "m25",
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: true,
        percentualParcelaPersonalizada: null,
      },
    });
    expect(r.saldoDevedorInicial).toBeCloseTo(1_860_000, 0);
    expect(r.lanceEmbutido).toBeCloseTo(465_000, 0);
    expect(r.saldoPosLance).toBeCloseTo(1_395_000, 0);
    // 1ª sem seguro 5.072,73; seguro 744; com seguro 5.816,73
    expect(r.parcelaReduzida).toBeCloseTo(5072.73, 1);
    expect(r.seguroPrimeiraParcela).toBeCloseTo(744, 1);
    expect(r.primeiraParcela).toBeCloseTo(5816.73, 1);
    // pós sem seguro = 1.395.000 / 210
    expect(r.saldoPosLance / 210).toBeCloseTo(6642.86, 1);
    // seguro pós = (1.395.000 − 5.816,73) × 0,0004
    expect(r.saldoDevedorFinal).toBeCloseTo(1_389_183.27, 0);
    expect(r.seguroMensal).toBeCloseTo(555.67, 1);
    expect(r.parcelaPosContemplacao).toBeCloseTo((1_860_000 - 465_000) / 208, 10);
  });

  it("imóvel 1533: lance 40% → parcela pós sem descontar a 1ª parcela", () => {
    const g24: GrupoConsorcio = {
      ...grupoBase,
      taxa_administrativa_percentual: 24,
      fundo_reserva_percentual: 0,
      prazo_total: 220,
      parcelas_realizadas: 11,
      prazo_restante: 209,
      percentual_parcela_reduzida: 60,
      tem_parcela_reduzida: true,
      seguro_percentual: 0.0004,
    };
    const cota15: GrupoCota = {
      ...cota,
      id: "c15b",
      valor_credito: 1_500_000,
      saldo_devedor: null as unknown as number,
    };
    const r = calcularLinhaSimulacaoGrupo({
      grupo: g24,
      cota: cota15,
      modalidades: [
        {
          id: "m40",
          grupo_id: g24.id,
          nome: "40%",
          percentual_lance_embutido: 40,
          percentual_recurso_proprio_minimo: 0,
          descricao: null,
          ativo: true,
          ordem: 0,
          created_at: "",
          updated_at: "",
        },
      ],
      config: {
        cotaId: cota15.id,
        quantidadeCotas: 1,
        modalidadeParcela: "reduzida",
        usaLanceEmbutido: true,
        modalidadeLanceId: "m40",
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: true,
        percentualParcelaPersonalizada: null,
      },
    });
    expect(r.lanceEmbutido).toBeCloseTo(744_000, 0);
    expect(r.saldoPosLance).toBeCloseTo(1_116_000, 0);
    expect(r.seguroPrimeiraParcela).toBeCloseTo(744, 1);
    // (1.116.000 − 5.816,73) × 0,0004
    expect(r.seguroMensal).toBeCloseTo(444.07, 1);
    expect(r.parcelaPosContemplacao).toBeCloseTo((1_860_000 - 744_000) / 208, 10);
  });
  it("agrega múltiplos grupos", () => {
    const linha = calcularLinhaSimulacaoGrupo({
      grupo: grupoBase,
      cota,
      modalidades: [],
      config: {
        cotaId: cota.id,
        quantidadeCotas: 2,
        modalidadeParcela: "reduzida",
        usaLanceEmbutido: true,
        modalidadeLanceId: null,
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: false,
        percentualParcelaPersonalizada: null,
      },
    });
    const tot = agregarResultadosLinhas([linha]);
    expect(tot.totalCotas).toBe(2);
    expect(tot.somaCotas).toBe(1_500_000);
    expect(linha.primeiraParcela).toBeCloseTo(linha.parcelaBase * 2, 2);
    expect(tot.primeiraParcela).toBeCloseTo(linha.primeiraParcela, 2);
  });

  it("lance percentual usa saldo devedor da linha", () => {
    const r = calcularLinhaSimulacaoGrupo({
      grupo: grupoBase,
      cota,
      modalidades: [
        {
          id: "m25",
          grupo_id: "g1",
          nome: "25% embutido",
          percentual_lance_embutido: 25,
          percentual_recurso_proprio_minimo: 0,
          descricao: null,
          ativo: true,
          ordem: 0,
          created_at: "",
          updated_at: "",
        },
      ],
      config: {
        cotaId: cota.id,
        quantidadeCotas: 1,
        modalidadeParcela: "reduzida",
        usaLanceEmbutido: true,
        modalidadeLanceId: "m25",
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: false,
        percentualParcelaPersonalizada: null,
      },
    });
    expect(r.saldoDevedorInicial).toBeCloseTo(750_000 * 1.22, 0);
    expect(r.lanceEmbutido).toBeCloseTo(750_000 * 1.22 * 0.25, 0);
    expect(r.lanceEmbutido).not.toBeCloseTo(cota.valor_credito! * 0.25, 0);
  });

  it("formato prazo", () => {
    expect(formatPrazoGrupo(grupoBase)).toBe("220 / 209 / 11");
  });

  it("caso obrigatório 500k / 24% / lances 25% + 10%", () => {
    const g: GrupoConsorcio = {
      ...grupoBase,
      taxa_administrativa_percentual: 22,
      fundo_reserva_percentual: 2,
      percentual_lance_embutido: 25,
    };
    const c: GrupoCota = {
      ...cota,
      valor_credito: 500_000,
      saldo_devedor: null,
    };
    const mods = [
      {
        id: "m25",
        grupo_id: "g1",
        nome: "25% + 10% próprio",
        percentual_lance_embutido: 25,
        percentual_recurso_proprio_minimo: 10,
        descricao: null,
        ativo: true,
        ordem: 0,
        created_at: "",
        updated_at: "",
      },
    ];
    const r = calcularLinhaSimulacaoGrupo({
      grupo: g,
      cota: c,
      modalidades: mods,
      config: {
        cotaId: c.id,
        quantidadeCotas: 1,
        modalidadeParcela: "integral",
        usaLanceEmbutido: true,
        modalidadeLanceId: "m25",
        usaRecursoProprio: true,
        recursoProprioModo: "percentual",
        recursoProprioInput: 10,
        usaSeguro: false,
        percentualParcelaPersonalizada: null,
      },
    });
    expect(r.saldoDevedorInicial).toBe(620_000);
    expect(r.lanceEmbutido).toBe(155_000);
    expect(r.recursoProprio).toBe(62_000);
    expect(r.lanceTotal).toBe(217_000);
    expect(r.saldoPosLance).toBe(403_000);
    expect(r.creditoLiquido).toBe(345_000);
  });

  it("lance total soma embutido + recurso próprio em R$", () => {
    const g: GrupoConsorcio = {
      ...grupoBase,
      taxa_administrativa_percentual: 15,
      fundo_reserva_percentual: 0,
      percentual_lance_embutido: 25,
    };
    const c: GrupoCota = {
      ...cota,
      valor_credito: 400_000,
      saldo_devedor: 460_000,
    };
    const mods = [
      {
        id: "m25",
        grupo_id: "g1",
        nome: "25% embutido",
        percentual_lance_embutido: 25,
        percentual_recurso_proprio_minimo: 0,
        descricao: null,
        ativo: true,
        ordem: 0,
        created_at: "",
        updated_at: "",
      },
    ];
    const r = calcularLinhaSimulacaoGrupo({
      grupo: g,
      cota: c,
      modalidades: mods,
      config: {
        cotaId: c.id,
        quantidadeCotas: 1,
        modalidadeParcela: "integral",
        usaLanceEmbutido: true,
        modalidadeLanceId: "m25",
        usaRecursoProprio: true,
        recursoProprioModo: "valor",
        recursoProprioInput: 15_000,
        usaSeguro: false,
        percentualParcelaPersonalizada: null,
      },
    });
    expect(r.saldoDevedorInicial).toBe(460_000);
    expect(r.lanceEmbutido).toBe(115_000);
    expect(r.recursoProprio).toBe(15_000);
    expect(r.lanceTotal).toBe(130_000);
    expect(r.saldoPosLance).toBe(330_000);
  });
});

describe("caso Excel — grupos 1513 e 1533", () => {
  const grupoExcel = (codigo: string, id: string): GrupoConsorcio => ({
    ...grupoBase,
    id,
    codigo_grupo: codigo,
    taxa_administrativa_percentual: 22,
    fundo_reserva_percentual: 2,
    seguro_habilitado: false,
    percentual_lance_embutido: 40,
    permite_lance_embutido: true,
  });

  const mod40 = [
    {
      id: "m40",
      grupo_id: "g",
      nome: "40% embutido",
      percentual_lance_embutido: 40,
      percentual_recurso_proprio_minimo: 0,
      descricao: null,
      ativo: true,
      ordem: 0,
      created_at: "",
      updated_at: "",
    },
  ];

  it("soma, lance e crédito líquido batem com planilha", () => {
    const c1513: GrupoCota = {
      ...cota,
      id: "c1513",
      valor_credito: 1_050_000,
      saldo_devedor: 1_037_000,
      valor_parcela: 3726.77,
    };
    const c1533: GrupoCota = {
      ...cota,
      id: "c1533",
      valor_credito: 1_000_000,
      saldo_devedor: 1_040_000,
      valor_parcela: 3726.76,
    };
    const cfg = {
      cotaId: "",
      quantidadeCotas: 1,
      modalidadeParcela: "reduzida" as const,
      usaLanceEmbutido: true,
      modalidadeLanceId: "m40",
      usaRecursoProprio: false,
      recursoProprioModo: "percentual" as const,
      recursoProprioInput: 0,
      usaSeguro: false,
      percentualParcelaPersonalizada: null,
    };
    const r1 = calcularLinhaSimulacaoGrupo({
      grupo: grupoExcel("1513", "g1513"),
      cota: c1513,
      modalidades: mod40,
      config: { ...cfg, cotaId: c1513.id },
    });
    const r2 = calcularLinhaSimulacaoGrupo({
      grupo: grupoExcel("1533", "g1533"),
      cota: c1533,
      modalidades: mod40,
      config: { ...cfg, cotaId: c1533.id },
    });
    const tot = agregarResultadosLinhas([r1, r2]);
    expect(tot.somaCotas).toBe(2_050_000);
    expect(tot.parcelaIntegralTotal).toBeCloseTo(
      r1.parcelaIntegral * r1.quantidadeCotas + r2.parcelaIntegral * r2.quantidadeCotas,
      2,
    );
    expect(tot.parcelaReduzidaTotal).toBeCloseTo(
      (r1.parcelaPersonalizada ?? r1.parcelaReduzida ?? 0) * r1.quantidadeCotas +
        (r2.parcelaPersonalizada ?? r2.parcelaReduzida ?? 0) * r2.quantidadeCotas,
      2,
    );
    expect(tot.lanceEmbutido).toBeCloseTo(1_016_800, 0);
    expect(tot.creditoLiquido).toBeCloseTo(1_033_200, 0);
  });

  it("parcela reduzida usa prazo total (Excel 1533)", () => {
    const g1533 = {
      ...grupoExcel("1533", "g1533"),
      seguro_pos_contemplacao: true,
      seguro_percentual: 0.0004,
      percentual_parcela_reduzida: 60,
    };
    const c1533: GrupoCota = {
      ...cota,
      id: "c1533x",
      valor_credito: 1_000_000,
      saldo_devedor: 1_240_000,
      valor_parcela: 3381.82,
      parcela_integral: 5636.36,
      parcela_reduzida: 3381.82,
      parcela_com_seguro: 6132.36,
      parcela_sem_seguro: 5636.36,
    };
    const r = calcularLinhaSimulacaoGrupo({
      grupo: g1533,
      cota: c1533,
      modalidades: mod40,
      config: {
        cotaId: c1533.id,
        quantidadeCotas: 1,
        modalidadeParcela: "reduzida",
        usaLanceEmbutido: true,
        modalidadeLanceId: "m40",
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: false,
        percentualParcelaPersonalizada: null,
      },
    });
    expect(r.parcelaIntegral).toBeCloseTo(5636.36, 1);
    expect(r.parcelaReduzida).toBeCloseTo(3381.82, 1);
    expect(r.parcelaBase).toBeCloseTo(3381.82, 1);
  });
});
