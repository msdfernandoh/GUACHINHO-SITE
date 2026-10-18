import { describe, expect, it } from "vitest";
import { parseRepasseRaconText } from "./repasse-racon-parser";

const sample = `Pedidos de Compras
RANDON ADMINISTRADORA DE CONSORCIOS LTDA
Valor TotalPonto de Venda: 939509 - RACON SINOP - GAUCHINHO CONSOR 2.014,00
Total Pedido: 2.014,00Data da Aprovação:Pedido: 17/08/20264504285621
002994 - ERONI BOLFEComissionado: Total Comissionado: 2.014,00
Produto: 000018 - IMÓVEIS PRÓ-RATA TOTAL
11/08/2026001 001453 0707 00 JANSER CARMOS AMARAL 001 / 010 Não Contemplada 0,7500 954,00127200,00
28/07/2026001 001453 1850 00 JULIANO FERNANDES DE AVILA 001 / 005 Não Contemplada 0,5000 1.060,00212000,00`;

describe("parser do relatório de repasse Racon", () => {
  it("extrai cabeçalho, pedido e linhas sem confundir valor base com comissão", () => {
    const result = parseRepasseRaconText(sample, "2026-08");
    expect(result.valor_total).toBe(2014);
    expect(result.pedidos).toEqual([{ numero: "4504285621", data_aprovacao: "2026-08-17" }]);
    expect(result.comissionado_nome).toBe("ERONI BOLFE");
    expect(result.itens).toHaveLength(2);
    expect(result.itens[0]).toMatchObject({ grupo: "001453", cota: "0707", parcela_numero: 1, valor_comissao: 954, valor_base: 127200 });
    expect(result.itens[1].valor_comissao).toBe(1060);
    expect(result.alertas).toEqual([]);
  });

  it.each(["2.015,00", "1.500,00"])("preserva todas as linhas e avisa quando o total do PDF é %s", (total) => {
    const result = parseRepasseRaconText(sample.replace("2.014,00", total), "2026-08");
    expect(result.itens).toEqual(parseRepasseRaconText(sample, "2026-08").itens);
    expect(result.alertas).toHaveLength(1);
    expect(result.alertas[0]).toContain("não confere");
    expect(result.alertas[0]).toContain("para conferência");
    expect(result.valor_total).toBe(total === "2.015,00" ? 2015 : 1500);
  });

  it("aceita o caso informado: linhas de 9318 e PDF de 8352,58", () => {
    const text = sample.replace("2.014,00", "8.352,58").replace("954,00127200,00", "8.258,001101066,67");
    const result = parseRepasseRaconText(text, "2026-08");
    expect(result.valor_total).toBe(8352.58);
    expect(result.itens.reduce((soma, item) => soma + item.valor_comissao, 0)).toBe(9318);
    expect(result.alertas.join(" ")).toContain("965,42");
  });

  it("continua rejeitando PDF sem linhas reconhecidas", () => {
    expect(() => parseRepasseRaconText(sample.split("Produto:")[0], "2026-08")).toThrow(/Nenhuma linha/);
  });
});
