import { describe, expect, it } from "vitest";
import { preencherTermo } from "./termos-preencher";

describe("preenchimento do termo", () => {
  const contratante = { razao_social: "Gauchinho LTDA", cnpj: "44276638000125", sede: "Rua Turim, 715, Sinop/MT", cidade: "Sinop/MT" };
  it("preenche partes e campos, e marca o que falta", () => {
    const t = preencherTermo(
      "CONTRATANTE: {{contratante_razao_social}}, CNPJ {{contratante_cnpj}}. PARTICIPANTE: {{participante_nome}}, CNPJ {{participante_documento}}, endereço {{participante_endereco}}, telefone {{participante_telefone}}. Vigência {{vigencia_meses}} meses. Foro {{foro}}.",
      {
        contratante,
        participante: { nome: "Imob Norte", cnpj: "11222333000181", endereco: null, email: "a@b.com", telefone: "66999990000", responsavel: "Ana" },
        campos: { vigencia_meses: "12" },
      },
    );
    expect(t).toContain("CNPJ 44.276.638/0001-25");
    expect(t).toContain("Imob Norte, CNPJ 11.222.333/0001-81");
    expect(t).toContain("endereço não informado");
    expect(t).toContain("(66) 99999-0000");
    expect(t).toContain("Vigência 12 meses");
    expect(t).toContain("Foro Sinop/MT");
    expect(t).not.toContain("{{");
  });
});
