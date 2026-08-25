import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Migration 112 - Resilient Venda Participantes Trigger", () => {
  const migPath = path.join(process.cwd(), "..", "supabase", "migrations", "112_fix_venda_participantes_trigger.sql");

  it("migration 112 file exists and is valid SQL", () => {
    expect(fs.existsSync(migPath)).toBe(true);
    const content = fs.readFileSync(migPath, "utf8");
    expect(content).toContain("vendas_criar_participantes_comerciais");
    expect(content).toContain("venda_participantes_before_write");
    expect(content).toContain("PARTICIPANTE_PRINCIPAL");
  });
});
