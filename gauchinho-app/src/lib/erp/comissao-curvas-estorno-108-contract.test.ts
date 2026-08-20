import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration108 = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/108_curvas_estorno_tenant_governance.sql"),
  "utf8"
);

describe("Contrato de Governança de Curvas de Estorno (Migration 108)", () => {
  it("adiciona empresa_id e descricao na tabela administradora_curvas_estorno", () => {
    expect(migration108).toContain("ALTER TABLE public.administradora_curvas_estorno");
    expect(migration108).toContain("ADD COLUMN IF NOT EXISTS empresa_id uuid");
    expect(migration108).toContain("ADD COLUMN IF NOT EXISTS descricao text");
  });

  it("garante deleção em cascata das faixas ao remover curva", () => {
    expect(migration108).toContain("DROP CONSTRAINT IF EXISTS administradora_curva_estorno_faixas_curva_id_fkey");
    expect(migration108).toContain("FOREIGN KEY (curva_id) REFERENCES public.administradora_curvas_estorno(id) ON DELETE CASCADE");
  });

  it("insere curva de estorno padrão regressiva", () => {
    expect(migration108).toContain("Curva Padrão de Estorno");
    expect(migration108).toContain("encerra_na_contemplacao");
  });
});
