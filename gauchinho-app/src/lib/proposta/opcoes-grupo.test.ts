import { describe, expect, it } from "vitest";
import { opcoesGrupoProposta } from "./opcoes-grupo";
import { parcelaDaNovaCota, valoresNovaCota } from "@/lib/erp/valores-nova-cota";

describe("Escolha da opção da proposta", () => {
  it("mantém os valores por linha e a referência original mesmo após uma linha inválida", () => {
    const dados = { totais: { somaCotas: 999000, primeiraParcela: 999 }, selecoes: [
      { grupoId: "g1", codigoGrupo: "001", cotaId: "c1", resultado: { somaCotas: 100000, primeiraParcela: 1200 } },
      {},
      { grupo: { id: "g2", codigo_grupo: "002" }, cota: { id: "c2", valor_credito: 120000 },
        config: { quantidadeCotas: 2, modalidadeParcela: "reduzida", usaSeguro: false }, resultado: { parcelaBase: 600 } },
    ] };
    expect(opcoesGrupoProposta(dados)).toMatchObject([
      { indice: 0, credito: 100000, parcela: 1200 },
      { indice: 2, grupoId: "g2", cotaId: "c2", credito: 240000, parcela: 1200, modalidade: "reduzida", seguro: false },
    ]);
    expect(dados.selecoes).toHaveLength(3);
  });
});

describe("Parcela da nova cota", () => {
  it("reutiliza as parcelas da cota quando a tabela de modalidade não tem o valor", () => {
    const grupo = { prazo_total: 100, tem_parcela_reduzida: true } as Parameters<typeof parcelaDaNovaCota>[0];
    const cota = { valor_credito: 100000, parcela_integral: 1250, parcela_reduzida_60: 750 } as Parameters<typeof parcelaDaNovaCota>[1];
    expect(parcelaDaNovaCota(grupo, cota, "INTEGRAL")?.valor_parcela).toBe(1250);
    expect(parcelaDaNovaCota(grupo, cota, "REDUZIDA_60_99")).toEqual({ valor_parcela: 750, percentual_reducao: 60 });
    expect(parcelaDaNovaCota(grupo, cota, "INTEGRAL", { valor_parcela: 1300 })?.valor_parcela).toBe(1300);
  });
  const grupo = { taxa_administrativa_percentual: 20, fundo_reserva_percentual: 5, seguro_percentual: 0.04 };
  it("inclui apenas o seguro selecionado sobre o saldo, sem trocar a parcela da modalidade", () => {
    expect(valoresNovaCota(100000, 600, grupo, false)).toEqual({ seguroMensal: 0, parcela: 600 });
    expect(valoresNovaCota(100000, 600, grupo, true)).toEqual({ seguroMensal: 50, parcela: 650 });
  });
});
