import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(path.join(process.cwd(), "..", "supabase", "migrations", "180_corrige_historico_formalizacao_multicotas.sql"), "utf8");

describe("correção operacional da formalização multicotas 180", () => {
  it("autoriza o evento emitido pela RPC 168", () => {
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS contratacoes_formalizacao_historico_evento_check");
    expect(migration).toContain("'COTAS_DEFINITIVAS_GERADAS'");
    expect(migration).toContain("'VENDA_FORMALIZADA'");
  });

  it("reconcilia apenas contratações sem venda e com quantidade válida", () => {
    expect(migration).toContain("NOT EXISTS (");
    expect(migration).toContain("q.quantidade BETWEEN 2 AND 100");
    expect(migration).not.toContain("UPDATE public.vendas");
    expect(migration).not.toContain("DELETE FROM");
  });
});
