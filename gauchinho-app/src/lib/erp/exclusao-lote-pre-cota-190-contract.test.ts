import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Contrato da migration 190 — exclusão Master antes da cota", () => {
  const root = path.resolve(process.cwd(), "..");
  const migration = fs.readFileSync(
    path.join(root, "supabase", "migrations", "190_exclusao_lote_pre_cota_master.sql"),
    "utf8",
  );
  const propostas = fs.readFileSync(path.join(process.cwd(), "src", "app", "admin", "propostas", "actions.ts"), "utf8");
  const contratacoes = fs.readFileSync(path.join(process.cwd(), "src", "app", "erp", "contratacoes", "actions.ts"), "utf8");

  it("restringe a operação ao Master e ao tenant ativo", () => {
    expect(migration).toContain("p.codigo = 'admin_empresa'");
    expect(migration).toContain("public.is_platform_superadmin()");
    expect(migration).toContain("eu.empresa_id = p_empresa_id");
    expect(propostas).toContain('vinculoAtivo.papel?.codigo !== "admin_empresa"');
    expect(contratacoes).toContain('vinculoAtivo.papel?.codigo !== "admin_empresa"');
  });

  it("bloqueia proposta ou contratação que já originou venda/cota", () => {
    expect(migration).toContain("FROM public.vendas v");
    expect(migration).toContain("v.proposta_id = ANY(p_ids)");
    expect(migration).toContain("v.contratacao_id = ANY(p_ids)");
    expect(migration).toContain("não pode ser excluída");
  });

  it("preserva os dados por exclusão lógica e registra auditoria", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS excluido_at");
    expect(migration).toContain("EXCLUSAO_LOTE_PRE_COTA");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.(propostas|contratacoes_online)/i);
  });
});
