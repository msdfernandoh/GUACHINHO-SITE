import { describe, expect, it } from "vitest";
import { resumoFinanceiroFromDados } from "./extract-fields";

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
});
