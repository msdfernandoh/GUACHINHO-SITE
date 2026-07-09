import { describe, expect, it } from "vitest";
import { generatePublicToken, isValidPublicToken } from "./public-token";

describe("public_token", () => {
  it("gera token url-safe", () => {
    const t = generatePublicToken();
    expect(t.length).toBeGreaterThanOrEqual(16);
    expect(isValidPublicToken(t)).toBe(true);
  });

  it("rejeita tokens inválidos", () => {
    expect(isValidPublicToken("abc")).toBe(false);
    expect(isValidPublicToken("token com espaço")).toBe(false);
  });
});
