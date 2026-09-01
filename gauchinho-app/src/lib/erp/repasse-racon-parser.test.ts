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

  it("recusa relatório cujo total não fecha", () => {
    expect(() => parseRepasseRaconText(sample.replace("2.014,00", "2.015,00"), "2026-08")).toThrow(/não confere/);
  });
});
