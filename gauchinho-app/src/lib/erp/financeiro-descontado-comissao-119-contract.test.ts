import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Migration 119 - Centros de Custo e Contas com flag descontado_comissao", () => {
  const migPath = join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "119_financeiro_centros_custo_descontado_comissao.sql"
  );

  it("o arquivo de migração 119 deve existir", () => {
    expect(existsSync(migPath)).toBe(true);
  });

  it("deve conter colunas descontado_comissao em centros_custo e contas_pagar", () => {
    const content = readFileSync(migPath, "utf-8");
    expect(content).toContain("ALTER TABLE public.financeiro_centros_custo");
    expect(content).toContain("descontado_comissao boolean");
    expect(content).toContain("ALTER TABLE public.financeiro_contas_pagar");
  });
});
