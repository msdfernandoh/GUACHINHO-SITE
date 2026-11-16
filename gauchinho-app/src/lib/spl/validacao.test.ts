import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  gerarCodigo,
  validarCadastroCliente,
  validarCadastroImobiliaria,
  validarCadastroVendedor,
  valorMonetarioBr,
} from "./validacao";

const base = {
  nome: "Imobiliária Norte",
  responsavel: "Ana Souza",
  telefone: "(66) 99955-4703",
  email: "ana@norte.com.br",
  cnpj: "11.222.333/0001-81",
  chave_pix: "ana@norte.com.br",
  modelo_parceria: "GERADOR_NEGOCIOS",
  quantidade_vendedores: 5,
  modelo_vendedores: "PROPRIO",
};

describe("cadastro da imobiliária", () => {
  it("aceita um cadastro completo", () => {
    const r = validarCadastroImobiliaria(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.telefone).toBe("66999554703");
      expect(r.data.cnpj).toBe("11222333000181");
    }
  });

  it("exige CNPJ e PIX de quem participa do plano", () => {
    expect(validarCadastroImobiliaria({ ...base, cnpj: "" }).ok).toBe(false);
    expect(validarCadastroImobiliaria({ ...base, chave_pix: "" }).ok).toBe(false);
  });

  it("quem só libera a carteira não precisa de CNPJ nem PIX", () => {
    const r = validarCadastroImobiliaria({ ...base, modelo_parceria: "SOMENTE_LIBERAR_CARTEIRA", cnpj: "", chave_pix: "" });
    expect(r.ok).toBe(true);
  });

  it("recusa CNPJ inválido", () => {
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(validarCadastroImobiliaria({ ...base, cnpj: "11222333000182" }).ok).toBe(false);
  });
});

describe("cadastro do vendedor", () => {
  it("modelo próprio não pede CPF nem PIX", () => {
    const r = validarCadastroVendedor({ nome: "João Lima", telefone: "66999990000" }, "PROPRIO");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.chave_pix).toBeNull();
  });

  it("gerador de negócios precisa de CPF e PIX", () => {
    expect(validarCadastroVendedor({ nome: "João Lima", telefone: "66999990000" }, "GERADOR_NEGOCIOS").ok).toBe(false);
    expect(
      validarCadastroVendedor(
        { nome: "João Lima", telefone: "66999990000", cpf: "529.982.247-25", chave_pix: "joao@pix" },
        "GERADOR_NEGOCIOS",
      ).ok,
    ).toBe(true);
  });
});

describe("cliente e valores", () => {
  it("lê valores em reais", () => {
    expect(valorMonetarioBr("R$ 350.000,00")).toBe(350_000);
    expect(valorMonetarioBr("350000")).toBe(350_000);
    expect(valorMonetarioBr("350.000")).toBe(350_000);
    expect(valorMonetarioBr("")).toBeNull();
  });

  it("valida o cliente", () => {
    const r = validarCadastroCliente({ nome: "Carlos", telefone: "66 99999-1111", empreendimento_slug: "Gaia", solucao: "CONSORCIO_SPL", valor_chaves: "350.000" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.empreendimento_slug).toBe("gaia");
      expect(r.data.valor_chaves).toBe(350_000);
    }
  });

  it("gera códigos legíveis", () => {
    expect(gerarCodigo(8)).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});
