import { describe, expect, it } from "vitest";
import { extrairTokenProposta, montarLinhasImagemProposta, type PropostaImagemPayload } from "./proposta-imagem";

const payload: PropostaImagemPayload = {
  contratacao: {
    protocolo: "GCH-001",
    tipo_bem: "Imóvel",
    credito_selecionado: 415_500,
    parcela_estimada: 3_523.96,
    prazo: 180,
    origem: "grupos",
    administradora: "Racon",
  },
  gruposLinhas: [{ codigoGrupo: "1453", modalidade: "Imóvel", quantidadeCotas: 2, parcelasRealizadas: 10 }],
  resumoFinanceiro: {
    saldoDevedor: 400_000,
    parcelaIntegral: 3_523.96,
    parcelaReduzida: 2_000,
    parcelaPosContemplacao: 3_100,
    lanceEmbutido: 40_000,
    recursoProprio: 10_000,
    lanceTotal: 50_000,
    creditoLiquido: 375_500,
    saldoPosLance: 350_000,
    seguro: 100,
    parcelasRestantes: 170,
    custoEfetivoMensal: 0.12,
    custoEfetivoAnual: 1.45,
  },
};

describe("imagem compartilhável da proposta", () => {
  it("usa o mesmo recorte da visualização resumida", () => {
    const linhas = montarLinhasImagemProposta(payload, "resumida");
    expect(linhas.some((l) => l.label === "Crédito contratado")).toBe(true);
    expect(linhas.some((l) => l.label === "Grupo 1453")).toBe(true);
    expect(linhas.some((l) => l.label === "Crédito líquido")).toBe(true);
    expect(linhas.some((l) => l.label === "Seguro")).toBe(false);
  });

  it("leva todos os detalhes financeiros para a imagem completa", () => {
    const linhas = montarLinhasImagemProposta(payload, "completa");
    expect(linhas.some((l) => l.label === "Administradora" && l.value === "Racon")).toBe(true);
    expect(linhas.some((l) => l.label === "Saldo devedor")).toBe(true);
    expect(linhas.some((l) => l.label === "Parcela após contemplação")).toBe(true);
    expect(linhas.some((l) => l.label === "Custo efetivo anual")).toBe(true);
  });

  it("extrai o token preservando parâmetros do link", () => {
    expect(extrairTokenProposta("https://site.test/proposta/abc-123?visualizacao=resumida")).toBe("abc-123");
  });
});
