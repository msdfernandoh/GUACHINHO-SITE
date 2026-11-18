import { describe, expect, it } from "vitest";
import {
  componentesDeEnvio, dentroDaJanela, ehPedidoDeDescadastro, montarComponentes, normalizarNomeTemplate, numeroWhatsapp,
  resolverParametros, validarTemplate, variaveisDoTexto, type TemplateForm,
} from "./templates-shared";

const base: TemplateForm = {
  nome: "boas_vindas", categoria: "MARKETING", idioma: "pt_BR", cabecalhoTipo: "TEXTO", cabecalhoTexto: "Gauchinho Consórcios",
  corpo: "Olá {{1}}, sua simulação de {{2}} está pronta.", exemplos: ["João", "R$ 350.000,00"], rodape: "Responda SAIR para não receber",
  botoes: [{ tipo: "QUICK_REPLY", texto: "Quero saber mais" }, { tipo: "URL", texto: "Ver site", url: "https://raconsinop.com.br" }, { tipo: "PHONE_NUMBER", texto: "Ligar", telefone: "+55 66 99608-6030" }],
};

describe("templates do WhatsApp", () => {
  it("monta os componentes no formato da Meta, com exemplos", () => {
    expect(validarTemplate(base, false)).toBeNull();
    const c = montarComponentes(base);
    expect(c[0]).toEqual({ type: "HEADER", format: "TEXT", text: "Gauchinho Consórcios" });
    expect(c[1]).toMatchObject({ type: "BODY", example: { body_text: [["João", "R$ 350.000,00"]] } });
    expect(c[3].buttons).toEqual([
      { type: "QUICK_REPLY", text: "Quero saber mais" },
      { type: "URL", text: "Ver site", url: "https://raconsinop.com.br" },
      { type: "PHONE_NUMBER", text: "Ligar", phone_number: "+5566996086030" },
    ]);
  });
  it("cabeçalho de imagem usa o handle do upload", () => {
    const f = { ...base, cabecalhoTipo: "IMAGEM" as const };
    expect(validarTemplate(f, false)).toContain("imagem");
    expect(montarComponentes(f, "4::aW1h")[0]).toEqual({ type: "HEADER", format: "IMAGE", example: { header_handle: ["4::aW1h"] } });
  });
  it("exige exemplo, variáveis em sequência e corpo sem variável nas pontas", () => {
    expect(validarTemplate({ ...base, exemplos: ["João"] }, false)).toContain("{{2}}");
    expect(validarTemplate({ ...base, corpo: "Olá {{1}} e {{3}} aqui", exemplos: ["a", "b", "c"] }, false)).toContain("seguidas");
    expect(validarTemplate({ ...base, corpo: "{{1}}, bom dia", exemplos: ["a"] }, false)).toContain("começar");
    expect(validarTemplate({ ...base, nome: "Boas Vindas" }, false)).toContain("Nome");
    expect(normalizarNomeTemplate("Boas-vindas Março!")).toBe("boas_vindas_marco_");
    expect(variaveisDoTexto("{{2}} {{1}} {{2}}")).toEqual([1, 2]);
  });
  it("monta o envio com imagem e variáveis e recusa valores faltando", () => {
    const c = montarComponentes({ ...base, cabecalhoTipo: "IMAGEM" }, "h");
    expect(componentesDeEnvio(c, ["Ana", "R$ 1"], "https://x/y.jpg")).toEqual([
      { type: "header", parameters: [{ type: "image", image: { link: "https://x/y.jpg" } }] },
      { type: "body", parameters: [{ type: "text", text: "Ana" }, { type: "text", text: "R$ 1" }] },
    ]);
    expect(() => componentesDeEnvio(c, ["Ana"], "https://x/y.jpg")).toThrow("variáveis");
    expect(() => componentesDeEnvio(c, ["Ana", "b"], null)).toThrow("imagem");
  });
});

describe("regras de envio", () => {
  it("normaliza números do Brasil e recusa inválidos", () => {
    expect(numeroWhatsapp("(66) 99608-6030")).toBe("5566996086030");
    expect(numeroWhatsapp("+55 66 99608-6030")).toBe("5566996086030");
    expect(numeroWhatsapp("6635311234")).toBe("556635311234");
    expect(numeroWhatsapp("123")).toBeNull();
    expect(numeroWhatsapp(null)).toBeNull();
  });
  it("resolve variáveis por contato", () => {
    expect(resolverParametros(["primeiro_nome", "fixo:R$ 350.000,00", "nome"], "joão da SILVA")).toEqual(["João", "R$ 350.000,00", "joão da SILVA"]);
    expect(resolverParametros(["primeiro_nome"], "")).toEqual(["tudo bem"]);
  });
  it("reconhece pedido de descadastro só quando é a mensagem inteira", () => {
    for (const t of ["SAIR", "parar.", " Não quero mais receber ", "stop"]) expect(ehPedidoDeDescadastro(t)).toBe(true);
    for (const t of ["quero sair do aluguel", "pode parar de me ligar e mandar proposta?", ""]) expect(ehPedidoDeDescadastro(t)).toBe(false);
  });
  it("respeita a janela de horário em Cuiabá", () => {
    expect(dentroDaJanela(8, 20, new Date("2026-11-16T14:00:00Z"))).toBe(true); // 10h
    expect(dentroDaJanela(8, 20, new Date("2026-11-16T02:00:00Z"))).toBe(false); // 22h
  });
});
