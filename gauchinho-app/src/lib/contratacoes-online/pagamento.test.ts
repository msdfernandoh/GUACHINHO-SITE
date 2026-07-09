import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTRATACAO_ONLINE_CONFIG,
  formasPagamentoDisponiveis,
  pixConfigValida,
} from "./pagamento";

describe("pagamento contratacao", () => {
  it("pix só aparece se ativo e com chave", () => {
    expect(formasPagamentoDisponiveis(DEFAULT_CONTRATACAO_ONLINE_CONFIG)).toEqual([
      "boleto",
      "cartao",
    ]);
    const ativo = {
      ...DEFAULT_CONTRATACAO_ONLINE_CONFIG,
      pix_primeira_parcela_ativo: true,
      pix_chave: "email@test.com",
    };
    expect(formasPagamentoDisponiveis(ativo)).toEqual(["pix", "boleto", "cartao"]);
    expect(pixConfigValida(ativo)).toBe(true);
  });
});
