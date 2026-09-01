import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const migration = fs.readFileSync(
  path.join(repoRoot, "supabase/migrations/181_corrige_idempotencia_append_only_formalizacao_multicotas.sql"),
  "utf8",
);

describe("Fase 184 — idempotência append-only na formalização multicotas", () => {
  it("remove o update da RPC sem enfraquecer o trigger append-only", () => {
    expect(migration).toContain("pg_get_functiondef");
    expect(migration).toContain("UPDATE public.operacoes_idempotentes");
    expect(migration).toContain("replace(");
    expect(migration).not.toMatch(/DROP TRIGGER[\s\S]*operacoes_idempotentes/i);
    expect(migration).not.toMatch(/DISABLE TRIGGER/i);
  });
});
