import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/138_snapshot_comercial_site_preservado_no_erp.sql"),
  "utf8",
);

describe("migration 138 — snapshot comercial site → ERP", () => {
  it("retira a tabela de valor por modalidade como fonte da parcela formalizada", () => {
    expect(sql).toContain("v_valor_parcela_aceita");
    expect(sql).toContain("v_contratacao.parcela_estimada");
    expect(sql).toContain("v_dados#>>'{totais,primeiraParcela}'");
    expect(sql).toContain("v_def := replace(v_def, 'v_valor_modalidade.valor_parcela', 'v_valor_parcela_aceita')");
  });

  it("impede trocar grupo/cota de uma proposta assinada pelo motor novo", () => {
    expect(sql).toContain("snapshot_calculo,hash_sha256");
    expect(sql).toContain("Grupo/produto diverge da proposta aceita");
  });

  it("não grava a parcela contratada no catálogo global compartilhado", () => {
    expect(sql).toContain("Catálogo global é alterado somente pela governança SaaS");
    expect(sql).toContain("Dual-write antigo de parcelas não encontrado");
  });
});
