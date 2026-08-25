import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Migration 117 — Cadastros Financeiros (Fornecedores, Bancos e Centros de Custo)", () => {
  const root = path.resolve(__dirname, "../../../../");
  const migrationPath = path.join(root, "supabase/migrations/117_financeiro_fornecedores_bancos_centros.sql");

  it("garante a existência do arquivo de migration 117", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("contém a criação da tabela financeiro_fornecedores e colunas de auto-criação", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.financeiro_fornecedores");
    expect(sql).toContain("fornecedor_id uuid REFERENCES public.financeiro_fornecedores(id)");
    expect(sql).toContain("rpc_obter_ou_criar_fornecedor");
    expect(sql).toContain("financeiro_fornecedores_select");
    expect(sql).toContain("financeiro_fornecedores_insert");
    expect(sql).toContain("financeiro_fornecedores_update");
    expect(sql).toContain("financeiro_fornecedores_delete");
  });

  it("contém a evolução das tabelas de bancos e centros de custo", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("ALTER TABLE public.financeiro_contas_bancarias");
    expect(sql).toContain("ALTER TABLE public.financeiro_centros_custo");
    expect(sql).toContain("tipo_conta text DEFAULT 'CORRENTE'");
    expect(sql).toContain("departamento text");
  });
});
