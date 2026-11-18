import { describe, expect, it } from "vitest";
import { podeDefinirModeloParceria } from "./types";

describe("escolha do modelo de parceria no painel SPL", () => {
  it("permite escolher ou alterar o modelo antes da aprovação", () => {
    expect(podeDefinirModeloParceria("PENDENTE", null)).toBe(true);
    expect(podeDefinirModeloParceria("PENDENTE", "GERADOR_NEGOCIOS")).toBe(true);
    expect(podeDefinirModeloParceria("RECUSADA", "GERADOR_NEGOCIOS")).toBe(true);
  });

  it("permite a primeira escolha no cadastro aprovado sem modelo e protege o modelo já definido", () => {
    expect(podeDefinirModeloParceria("APROVADA", null)).toBe(true);
    expect(podeDefinirModeloParceria("APROVADA", "GERADOR_OPORTUNIDADES")).toBe(false);
    expect(podeDefinirModeloParceria("APROVADA", "SOMENTE_LIBERAR_CARTEIRA")).toBe(false);
    expect(podeDefinirModeloParceria("INATIVA", null)).toBe(false);
  });
});
