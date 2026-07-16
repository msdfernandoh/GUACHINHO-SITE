import { describe, expect, it } from "vitest";
import { dbErrorMessage, isDbMissingColumnError } from "./db-ready";

describe("db-ready", () => {
  it("extrai message de PostgrestError (objeto sem instanceof Error)", () => {
    const err = {
      message: "Could not find the 'leads_acesso_todos' column of 'eventos' in the schema cache",
      code: "PGRST204",
    };
    expect(dbErrorMessage(err)).toContain("leads_acesso_todos");
    expect(isDbMissingColumnError(err)).toBe(true);
  });

  it("reconhece Error clássico de coluna", () => {
    expect(isDbMissingColumnError(new Error('column "endereco" does not exist'))).toBe(true);
  });
});
