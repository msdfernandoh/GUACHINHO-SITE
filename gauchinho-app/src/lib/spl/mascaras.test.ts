import { describe, expect, it } from "vitest";
import { mascaraCnpj, mascaraCpf, mascaraPix, mascaraTelefone } from "./mascaras";
import { opcoesRemuneracaoVendedor } from "./types";

describe("máscaras", () => {
  it("telefone com no máximo 11 números", () => {
    expect(mascaraTelefone("669999999999999999999")).toBe("(66) 99999-9999");
    expect(mascaraTelefone("6699998888")).toBe("(66) 9999-8888");
    expect(mascaraTelefone("66")).toBe("(66");
  });
  it("CNPJ e CPF", () => {
    expect(mascaraCnpj("11222333000181999")).toBe("11.222.333/0001-81");
    expect(mascaraCpf("52998224725")).toBe("529.982.247-25");
  });
  it("PIX segue o tipo", () => {
    expect(mascaraPix("CELULAR", "66996086030")).toBe("(66) 99608-6030");
    expect(mascaraPix("EMAIL", " Ana@X.com ")).toBe("ana@x.com");
  });
});

describe("remuneração dos vendedores", () => {
  it("desconta do percentual da imobiliária e avisa quando repassa tudo", () => {
    const go = opcoesRemuneracaoVendedor("GERADOR_OPORTUNIDADES");
    expect(go.find((o) => o.value === "GERADOR_NEGOCIOS")?.permitido).toBe(false);
    expect(go.find((o) => o.value === "GERADOR_OPORTUNIDADES")?.repassaTudo).toBe(true);
    const micro = opcoesRemuneracaoVendedor("MICROFRANQUIA");
    expect(micro.find((o) => o.value === "GERADOR_NEGOCIOS")?.ficaImobiliaria).toBe(25);
  });
});
