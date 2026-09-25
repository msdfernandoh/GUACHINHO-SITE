import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("importação de Meus contatos", () => {
  it("consolida telefones repetidos antes do upsert e processa arquivos grandes em lotes", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/admin/contatos/actions.ts"),
      "utf8",
    );

    expect(source).toContain("const contactsByPhone = new Map<string, ContactInput>()");
    expect(source).toContain("contactsByPhone.set(telefoneNormalizado, normalized)");
    expect(source).toContain("IMPORT_BATCH_SIZE = 500");
    expect(source).toContain("rows.slice(start, start + IMPORT_BATCH_SIZE)");
    expect(source).toContain("duplicatesIgnored: validItemsCount - rows.length");
  });
});
