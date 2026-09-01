import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = path.resolve(process.cwd(), "..");
const sql = fs.readFileSync(path.join(repo, "supabase/migrations/183_comissoes_independentes_por_cota.sql"), "utf8");
const view = fs.readFileSync(path.join(process.cwd(), "src/components/erp/vendas/erp-vendas-hub-view.tsx"), "utf8");

describe("Fase 186 — independência operacional por cota", () => {
  it("gera previsões próprias preservando o total", () => {
    expect(sql).toContain("distribuir_previsoes_por_cota");
    expect(sql).toContain("cota_definitiva_id");
    expect(sql).toContain("valor_total_original");
    expect(sql).toContain("trunc(v_prev_f.valor_previsto*100/v_quantidade)/100");
  });

  it("isola contemplação e cancelamento por cota", () => {
    expect(sql).toContain("cota_definitiva_id = p_cota_id");
    expect(sql).toContain("c.status<>''cancelada''");
    expect(sql).toContain("TO service_role");
  });

  it("mostra e opera todas as cotas da venda", () => {
    expect(view).toContain("cotasDaVenda");
    expect(view).toContain("Contemplar cota");
    expect(view).toContain("Cancelar cota");
    expect(view).toContain("operacoesPorCota");
  });

  it("redistribui as previsões depois de um recálculo master", () => {
    const actions = fs.readFileSync(path.join(process.cwd(), "src/app/erp/vendas/actions.ts"), "utf8");
    expect(actions).toContain('admin.rpc("distribuir_previsoes_por_cota"');
  });
});
