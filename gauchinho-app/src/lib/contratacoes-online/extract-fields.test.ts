import { describe, expect, it } from "vitest";
import { resumoFinanceiroFromDados, linhasGrupoResumoFromDados } from "./extract-fields";

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
});
