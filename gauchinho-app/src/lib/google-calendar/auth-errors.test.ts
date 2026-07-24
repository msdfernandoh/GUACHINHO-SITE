import { describe, expect, it } from "vitest";
import { classifyGoogleTokenError } from "./auth-errors";

describe("classifyGoogleTokenError", () => {
  it("cenário 3: invalid_grant é falha definitiva", () => {
    expect(classifyGoogleTokenError({ error: "invalid_grant" }, 400)).toBe("invalid_grant");
  });

  it("erro 500 é temporário", () => {
    expect(classifyGoogleTokenError({ error: "server_error" }, 503)).toBe("transient");
  });
});
