import { describe, expect, it } from "vitest";
import {
  normalizeTelefoneSorteio,
  telefoneJaParticipouSorteio,
  telefoneSorteioValido,
} from "./vagas";

describe("telefoneSorteioValido", () => {
  it("aceita telefone BR com DDD", () => {
    expect(telefoneSorteioValido("(51) 99999-8888")).toBe(true);
  });

  it("rejeita telefone curto", () => {
    expect(telefoneSorteioValido("123")).toBe(false);
  });
});

describe("telefoneJaParticipouSorteio", () => {
  it("bloqueia duplicado quando não permitido", () => {
    const existentes = ["51999998888"];
    expect(
      telefoneJaParticipouSorteio("(51) 99999-8888", existentes, false),
    ).toBe(true);
  });

  it("permite duplicado quando configurado", () => {
    expect(telefoneJaParticipouSorteio("(51) 99999-8888", ["51999998888"], true)).toBe(false);
  });

  it("normaliza dígitos", () => {
    expect(normalizeTelefoneSorteio("(51) 99999-8888")).toBe("51999998888");
  });
});

describe("cadastro participante válido", () => {
  it("validação de telefone e duplicidade cobre fluxo básico", () => {
    const tel = "(51) 98888-7777";
    expect(telefoneSorteioValido(tel)).toBe(true);
    expect(telefoneJaParticipouSorteio(tel, [], false)).toBe(false);
    expect(telefoneJaParticipouSorteio(tel, [tel], false)).toBe(true);
  });
});
