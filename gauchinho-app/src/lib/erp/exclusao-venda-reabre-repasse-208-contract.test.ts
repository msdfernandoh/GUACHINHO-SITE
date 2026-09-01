import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/208_exclusao_venda_reabre_repasse.sql"), "utf8");
const actions = fs.readFileSync(path.join(process.cwd(), "src/app/erp/vendas/actions.ts"), "utf8");
const view = fs.readFileSync(path.join(process.cwd(), "src/components/erp/vendas/erp-vendas-hub-view.tsx"), "utf8");

describe("Fase 208 — exclusão de venda vinculada ao repasse", () => {
  it("reverte os livros append-only antes de reabrir a linha", () => {
    expect(migration).toContain("INSERT INTO public.financeiro_recebimento_itens");
    expect(migration).toContain("INSERT INTO public.erp_repasse_item_baixas");
    expect(migration).toContain("-v_alocacao, 'REVERSAO'");
    expect(migration).toContain("status_conciliacao = 'NAO_ENCONTRADO'");
    expect(migration).toContain("previsao_franquia_id = NULL");
  });

  it("preserva histórico e impede exclusão silenciosa de comissão paga", () => {
    expect(migration).toContain("COALESCE(valor_pago, 0) > 0");
    expect(migration).toContain("exclusao_administrativa_208");
    expect(migration).toContain("historico_preservado");
  });

  it("atualiza a orientação e invalida a tela do repasse", () => {
    expect(view).toContain("reabre a linha como não encontrada");
    expect(actions).toContain('revalidatePath("/erp/repasse-franquia")');
  });
});
