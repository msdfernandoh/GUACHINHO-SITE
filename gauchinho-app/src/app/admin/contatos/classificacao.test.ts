import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("classificação privada de contatos", () => {
  it("cria tags indexadas sem ampliar o escopo da tabela", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "../supabase/migrations/293_contatos_usuario_tags_classificacao.sql"),
      "utf8",
    );

    expect(migration).toContain("add column if not exists tags text[] not null default '{}'::text[]");
    expect(migration).toContain("using gin (tags)");
    expect(migration).not.toContain("disable row level security");
  });
});
