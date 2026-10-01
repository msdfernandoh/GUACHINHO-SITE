import { describe, expect, it } from "vitest";
import {
  mensagemValidacaoEtapaCadastroParceiro,
  type CadastroParceiroEtapa,
} from "./cadastro-parceiro-validation";

const form: CadastroParceiroEtapa = {
  nome: "Pessoa Teste",
  whatsapp: "(66) 99999-9999",
  email: "pessoa@example.com",
  cpf: "543.370.660-55",
  cidade: "Sinop",
  estado: "MT",
  profissao: "Vendas",
  chavePix: "pessoa@example.com",
  jaVendeConsorcio: "Não",
  potencialMensal: "Até R$ 500 mil",
  interesseNetwork: "Quero saber mais",
};

describe("validação conversacional do cadastro de parceiro", () => {
  it("aceita CPF e e-mail válidos na etapa de acesso", () => {
    expect(mensagemValidacaoEtapaCadastroParceiro(1, form, "GERADOR_POSSIBILIDADES")).toBeNull();
  });

  it("explica que os últimos dígitos do CPF não devem ser digitados no campo de e-mail", () => {
    expect(
      mensagemValidacaoEtapaCadastroParceiro(1, { ...form, email: "066055" }, "GERADOR_POSSIBILIDADES"),
    ).toContain("Informe seu e-mail neste campo");
  });

  it("informa o campo exato que falta em cada etapa", () => {
    expect(mensagemValidacaoEtapaCadastroParceiro(0, { ...form, whatsapp: "66" }, "GERADOR_POSSIBILIDADES")).toContain("WhatsApp");
    expect(mensagemValidacaoEtapaCadastroParceiro(2, { ...form, cidade: "" }, "GERADOR_POSSIBILIDADES")).toContain("cidade");
    expect(mensagemValidacaoEtapaCadastroParceiro(4, { ...form, chavePix: "" }, "GERADOR_POSSIBILIDADES")).toContain("PIX");
  });
});

