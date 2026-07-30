import { describe, expect, it } from "vitest";
import { buildPropostaVisualizacaoUrl } from "./proposta-visualizacao";

describe("buildPropostaVisualizacaoUrl", () => {
  it("mantém o link completo sem parâmetro de visualização", () => {
    expect(
      buildPropostaVisualizacaoUrl(
        "https://gauchinho.com.br/proposta/token?visualizacao=resumida",
        "completa",
      ),
    ).toBe("https://gauchinho.com.br/proposta/token");
  });

  it("adiciona a visualização resumida preservando outros parâmetros", () => {
    expect(
      buildPropostaVisualizacaoUrl(
        "https://gauchinho.com.br/proposta/token?origem=grupos",
        "resumida",
      ),
    ).toBe(
      "https://gauchinho.com.br/proposta/token?origem=grupos&visualizacao=resumida",
    );
  });
});
