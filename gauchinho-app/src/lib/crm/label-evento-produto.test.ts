import { describe, expect, it } from "vitest";
import { labelEventoProduto } from "./label-evento-produto";

describe("labelEventoProduto", () => {
  it("mostra evento e produto separados quando distintos", () => {
    expect(
      labelEventoProduto({
        evento_nome: "GENOVA TRIBO AGUIA",
        produto_interesse: "Veículo",
        tipo_interesse: "Veículo",
      }),
    ).toBe("GENOVA TRIBO AGUIA · Veículo");
  });

  it("não duplica quando produto_interesse é o próprio nome do evento", () => {
    expect(
      labelEventoProduto({
        evento_nome: "GENOVA TRIBO AGUIA",
        produto_interesse: "GENOVA TRIBO AGUIA",
        tipo_interesse: null,
      }),
    ).toBe("GENOVA TRIBO AGUIA");
  });

  it("cai para produto quando não há evento", () => {
    expect(
      labelEventoProduto({
        evento_nome: null,
        produto_interesse: "Imóvel",
        tipo_interesse: null,
      }),
    ).toBe("Imóvel");
  });
});
