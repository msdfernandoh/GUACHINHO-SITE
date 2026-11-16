import { describe, expect, it } from "vitest";
import { CABECALHOS_CARTEIRA, interpretarCarteira } from "./planilha";

describe("planilha da carteira", () => {
  it("lê as colunas do modelo e acha o empreendimento pelo nome", () => {
    const linhas = interpretarCarteira(
      [[...CABECALHOS_CARTEIRA], ["Maria", "66999990000", "", "Gaia", "302", "Sim", "350000"], ["", "", "", "", "", "", ""]],
      [{ slug: "gaia", nome: "Gaia" }],
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ nome: "Maria", empreendimento_slug: "gaia", situacao: "JA_COMPROU", valor_chaves: "350000" });
  });

  it("exige nome e telefone", () => {
    expect(() => interpretarCarteira([["Email"]], [])).toThrow();
  });
});
