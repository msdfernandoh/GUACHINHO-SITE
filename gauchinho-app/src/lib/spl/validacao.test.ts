import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  gerarCodigo,
  validarCadastroCliente,
  validarCadastroImobiliaria,
  validarCadastroVendedor,
  validarChavePix,
  valorMonetarioBr,
} from "./validacao";

const base = {
  nome: "Imobiliária Norte",
  responsavel: "Ana Souza",
  telefone: "(66) 99955-4703",
  email: "ana@norte.com.br",
  cnpj: "11.222.333/0001-81",
  chave_pix: "ana@norte.com.br",
  chave_pix_tipo: "EMAIL",
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

  it("aceita sem CNPJ (cadastro incompleto), mas exige PIX de quem participa", () => {
    const r = validarCadastroImobiliaria({ ...base, cnpj: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.cnpj).toBeNull();
    expect(validarCadastroImobiliaria({ ...base, chave_pix: "" }).ok).toBe(false);
    expect(validarCadastroImobiliaria({ ...base, chave_pix_tipo: "" }).ok).toBe(false);
  });

  it("valida a chave PIX pelo tipo", () => {
    expect(validarChavePix("CELULAR", "(66) 99608-6030")).toEqual({ ok: true, data: { tipo: "CELULAR", chave: "66996086030" } });
    expect(validarChavePix("CPF", "529.982.247-25").ok).toBe(true);
    expect(validarChavePix("CPF", "111.111.111-11").ok).toBe(false);
    expect(validarChavePix("CNPJ", "11.222.333/0001-81").ok).toBe(true);
    expect(validarChavePix("EMAIL", "nao-e-email").ok).toBe(false);
    expect(validarChavePix("ALEATORIA", "123e4567-e89b-12d3-a456-426614174000").ok).toBe(true);
    expect(validarChavePix("ALEATORIA", "abc").ok).toBe(false);
  });

  it("aceita escolher o modelo de cada vendedor", () => {
    const r = validarCadastroImobiliaria({ ...base, modelo_vendedores: "POR_VENDEDOR" });
    expect(r.ok).toBe(true);
  });

  it("não deixa o vendedor ganhar mais que a imobiliária", () => {
    expect(validarCadastroImobiliaria({ ...base, modelo_parceria: "GERADOR_OPORTUNIDADES", modelo_vendedores: "GERADOR_NEGOCIOS" }).ok).toBe(false);
    expect(validarCadastroImobiliaria({ ...base, modelo_parceria: "GERADOR_OPORTUNIDADES", modelo_vendedores: "GERADOR_OPORTUNIDADES" }).ok).toBe(true);
    expect(validarCadastroImobiliaria({ ...base, modelo_parceria: "SOMENTE_LIBERAR_CARTEIRA", cnpj: "", chave_pix: "", chave_pix_tipo: "", modelo_vendedores: "GERADOR_OPORTUNIDADES" }).ok).toBe(false);
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
        { nome: "João Lima", telefone: "66999990000", cpf: "529.982.247-25", chave_pix: "joao@pix.com", chave_pix_tipo: "EMAIL" },
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
