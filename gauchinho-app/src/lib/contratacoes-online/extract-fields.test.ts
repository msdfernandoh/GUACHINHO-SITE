import { describe, expect, it } from "vitest";
import {
  extrairCamposFlat,
  resumoFinanceiroFromDados,
  linhasGrupoResumoFromDados,
} from "./extract-fields";

describe("resumoFinanceiroFromDados — grupos", () => {
  it("preserva parcelaPosContemplacao da linha sem confundir com parcelas iniciais", () => {
    const dados = {
      selecoes: [
        {
          grupoId: "g1",
          cotaId: "c1",
          resultado: {
            saldoDevedorInicial: 1_302_000,
            parcelaIntegral: 5918.18,
            parcelaReduzida: 3550.91,
            parcelaPosContemplacao: 5015.2,
            lanceEmbutido: 325_500,
            creditoLiquido: 724_500,
            saldoPosLance: 976_500,
            primeiraParcela: 3550.91,
          },
        },
      ],
      totais: {
        parcelaPosContemplacaoTotal: 5015.2,
        primeiraParcela: 3550.91,
      },
    };

    const fin = resumoFinanceiroFromDados("grupos", dados);

    expect(fin.parcelaPosContemplacao).toBe(5015.2);
    expect(fin.parcelaReduzida).toBe(3550.91);
    expect(fin.parcelaIntegral).toBe(5918.18);
    expect(fin.parcelaPosContemplacao).not.toBe(fin.parcelaReduzida);
    expect(fin.parcelaPosContemplacao).not.toBe(fin.parcelaIntegral);
  });

  it("usa parcela personalizada no campo reduzida quando modalidade é personalizada", () => {
    const fin = resumoFinanceiroFromDados("grupos", {
      selecoes: [
        {
          config: { modalidadeParcela: "personalizada", percentualParcelaPersonalizada: 40 },
          resultado: {
            parcelaIntegral: 1704.55,
            parcelaReduzida: 1022.73,
            parcelaPersonalizada: 681.82,
            parcelaBase: 681.82,
            primeiraParcela: 681.82,
          },
        },
      ],
      totais: {},
    });
    expect(fin.parcelaReduzida).toBe(681.82);
    expect(fin.parcelaIntegral).toBe(1704.55);
    expect(fin.percentualParcelaReduzida).toBe(40);
  });

  it("consolida parcelas pela quantidade de cotas mesmo em snapshots antigos", () => {
    const fin = resumoFinanceiroFromDados("grupos", {
      selecoes: [
        {
          config: { quantidadeCotas: 4, modalidadeParcela: "reduzida" },
          resultado: {
            quantidadeCotas: 4,
            parcelaIntegral: 1346.2,
            parcelaReduzida: 807.72,
          },
        },
      ],
      totais: {
        parcelaIntegralTotal: 1346.2,
        parcelaReduzidaTotal: 807.72,
      },
    });

    expect(fin.parcelaIntegral).toBeCloseTo(5384.8, 2);
    expect(fin.parcelaReduzida).toBeCloseTo(3230.88, 2);
    expect(fin.percentualParcelaReduzida).toBe(60);
  });

  it("usa parcelaPosContemplacaoTotal dos totais quando linha não traz o campo", () => {
    const fin = resumoFinanceiroFromDados("grupos", {
      selecoes: [{ resultado: { parcelaIntegral: 100, parcelaReduzida: 60 } }],
      totais: { parcelaPosContemplacaoTotal: 88.5 },
    });
    expect(fin.parcelaPosContemplacao).toBe(88.5);
  });

  it("inclui custo efetivo e parcelas restantes a partir do grupo", () => {
    const fin = resumoFinanceiroFromDados("grupos", {
      selecoes: [
        {
          resultado: {
            parcelaPosContemplacao: 1569.8,
            parcelasRestantesPosContemplacao: 107,
          },
          grupo: {
            codigo_grupo: "5488",
            prazo_total: 120,
            prazo_restante: 108,
            taxa_administrativa_percentual: 18,
          },
        },
      ],
      totais: {},
    });
    expect(fin.parcelasRestantes).toBe(108);
    expect(fin.custoEfetivoMensal).toBeCloseTo(18 / 120, 5);
    expect(fin.custoEfetivoAnual).toBeCloseTo((18 / 120) * 12, 5);
  });

  it("lista vários grupos com código, cotas e meses decorridos", () => {
    const linhas = linhasGrupoResumoFromDados("grupos", {
      selecoes: [
        {
          config: { quantidadeCotas: 2 },
          resultado: { quantidadeCotas: 2 },
          grupo: {
            codigo_grupo: "1463",
            modalidade: "Imóvel",
            parcelas_realizadas: 12,
          },
        },
        {
          config: { quantidadeCotas: 1 },
          grupo: { codigo_grupo: "1273", modalidade: "Imóvel", parcelas_realizadas: 5 },
        },
      ],
    });
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      codigoGrupo: "1463",
      quantidadeCotas: 2,
      parcelasRealizadas: 12,
    });
    expect(linhas[1]?.codigoGrupo).toBe("1273");
  });

  it("calcula o valor unitário quando a linha possui mais de uma cota", () => {
    const linhas = linhasGrupoResumoFromDados("grupos", {
      selecoes: [
        {
          config: { quantidadeCotas: 3 },
          resultado: { quantidadeCotas: 3, somaCotas: 327_818.1 },
          grupo: { codigo_grupo: "5288", modalidade: "Auto" },
        },
      ],
    });

    expect(linhas[0]?.valorCota).toBeCloseTo(109_272.7, 2);
  });

  it("soma os valores de todos os grupos na proposta", () => {
    const dados = {
      selecoes: [
        {
          grupoId: "g1",
          cotaId: "c1",
          grupo: { codigo_grupo: "1193", modalidade: "Imóvel", prazo_total: 180 },
          resultado: {
            somaCotas: 305_438.77,
            primeiraParcela: 2_255.63,
            saldoDevedorInicial: 378_744.07,
            parcelaIntegral: 2_104.13,
            parcelaReduzida: 0,
            lanceEmbutido: 94_686.02,
            recursoProprio: 0,
            lanceTotal: 94_686.02,
            creditoLiquido: 210_752.75,
            saldoPosLance: 284_058.05,
            seguroMensal: 112.72,
            parcelaPosContemplacao: 6_156.51,
          },
        },
        {
          grupoId: "g2",
          cotaId: "c2",
          grupo: { codigo_grupo: "1453", modalidade: "Imóvel", prazo_total: 200 },
          resultado: {
            somaCotas: 254_400,
            primeiraParcela: 1_130.8,
            saldoDevedorInicial: 323_088,
            parcelaIntegral: 1_884.67,
            parcelaReduzida: 1_130.8,
            lanceEmbutido: 0,
            recursoProprio: 96_926.4,
            lanceTotal: 96_926.4,
            creditoLiquido: 254_400,
            saldoPosLance: 226_161.6,
            seguroMensal: 112.52,
            parcelaPosContemplacao: 1_328.44,
          },
        },
      ],
      totais: {
        somaCotas: 559_838.77,
        primeiraParcela: 3_386.43,
        saldoDevedorInicial: 701_832.07,
        parcelaIntegralTotal: 3_988.8,
        parcelaReduzidaTotal: 1_130.8,
        lanceEmbutido: 94_686.02,
        recursoProprio: 96_926.4,
        lanceTotal: 191_612.42,
        creditoLiquido: 465_152.75,
        saldoPosLance: 510_219.65,
        seguroTotal: 225.24,
        parcelaPosContemplacaoTotal: 7_484.95,
        parcelasRestantesMax: 185,
      },
    };

    const flat = extrairCamposFlat("grupos", dados);
    const financeiro = resumoFinanceiroFromDados("grupos", dados);

    expect(flat.credito_selecionado).toBe(559_838.77);
    expect(flat.parcela_estimada).toBe(3_386.43);
    expect(financeiro).toMatchObject({
      saldoDevedor: 701_832.07,
      parcelaIntegral: 3_988.8,
      parcelaReduzida: 1_130.8,
      lanceTotal: 191_612.42,
      creditoLiquido: 465_152.75,
      saldoPosLance: 510_219.65,
      seguro: 225.24,
      parcelaPosContemplacao: 7_484.95,
      parcelasRestantes: 185,
    });
  });
});
