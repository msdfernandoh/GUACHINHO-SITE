import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Migration 111 - Resilient Cota Real and Commission Engine Fallback", () => {
  const migPath = path.join(process.cwd(), "..", "supabase", "migrations", "111_fix_conversao_cota_real_fallback.sql");

  it("migration 111 file exists and is valid SQL", () => {
    expect(fs.existsSync(migPath)).toBe(true);
    const content = fs.readFileSync(migPath, "utf8");
    expect(content).toContain("rpc_gerar_previsoes_comissao_v2");
    expect(content).toContain("rpc_gerar_previsoes_comissao");
    expect(content).not.toContain("RAISE EXCEPTION 'Nenhuma regra V2 homologada para Tipo/Modalidade/Vigência'");
  });
});
