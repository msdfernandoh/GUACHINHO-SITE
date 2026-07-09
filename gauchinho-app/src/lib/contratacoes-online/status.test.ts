import { describe, expect, it } from "vitest";
import { statusPermiteEdicaoPublica } from "./status";

describe("bloqueio edição pública", () => {
  it("bloqueia após aguardando consultor", () => {
    expect(statusPermiteEdicaoPublica("proposta_confirmada")).toBe(true);
    expect(statusPermiteEdicaoPublica("aguardando_consultor")).toBe(false);
    expect(statusPermiteEdicaoPublica("finalizado")).toBe(false);
  });
});
