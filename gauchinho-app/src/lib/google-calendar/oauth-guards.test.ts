import { describe, expect, it } from "vitest";
import { shouldBindGoogleOAuthToken } from "./oauth-guards";

describe("shouldBindGoogleOAuthToken", () => {
  it("cenário 6: cookie de João com sessão de Carla — rejeita", () => {
    expect(shouldBindGoogleOAuthToken("joao-id", { id: "carla-id" })).toBe(false);
  });

  it("aceita quando cookie e sessão coincidem", () => {
    expect(shouldBindGoogleOAuthToken("joao-id", { id: "joao-id" })).toBe(true);
  });

  it("rejeita sem sessão", () => {
    expect(shouldBindGoogleOAuthToken("joao-id", null)).toBe(false);
  });
});
