import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Migration 118 — Storage e Nota Fiscal em Contas a Pagar", () => {
  const root = path.resolve(__dirname, "../../../../");
  const migrationPath = path.join(root, "supabase/migrations/118_contas_pagar_storage_nf_comprovantes.sql");

  it("garante a existência do arquivo de migration 118", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("contém a criação do bucket contas-pagar-documentos e políticas de RLS", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("contas-pagar-documentos");
    expect(sql).toContain("contas_pagar_documentos_public_read");
    expect(sql).toContain("contas_pagar_documentos_auth_insert");
    expect(sql).toContain("contas_pagar_documentos_auth_update");
    expect(sql).toContain("contas_pagar_documentos_auth_delete");
  });

  it("contém a adição das colunas de nota fiscal em financeiro_contas_pagar", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("ALTER TABLE public.financeiro_contas_pagar");
    expect(sql).toContain("comprovante_url text");
    expect(sql).toContain("nota_fiscal_nome text");
    expect(sql).toContain("nota_fiscal_uploaded_at timestamptz");
  });
});
