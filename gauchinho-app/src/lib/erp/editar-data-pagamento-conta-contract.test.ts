import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(process.cwd(), "..");
const migration = readFileSync(resolve(raiz, "supabase/migrations/301_editar_data_pagamento_conta_pagar.sql"), "utf8");
const action = readFileSync(resolve(process.cwd(), "src/app/erp/contas-pagar/actions.ts"), "utf8");
const contasUi = readFileSync(resolve(process.cwd(), "src/app/erp/contas-pagar/ui.tsx"), "utf8");
const fechamentoUi = readFileSync(resolve(process.cwd(), "src/app/erp/fechamento-socios/painel.tsx"), "utf8");

describe("edição da data de pagamento", () => {
  it("envia e exibe a data nas duas interfaces de edição", () => {
    expect(action).toContain("p_pago_em: pagoEm");
    expect(contasUi).toContain("Data do pagamento *");
    expect(contasUi).toContain('name="pago_em"');
    expect(fechamentoUi).toContain("Data do pagamento");
    expect(fechamentoUi).toContain('name="pago_em"');
  });

  it("restringe a mudança do fato pago e mantém o caixa append-only", () => {
    expect(migration).toContain("Apenas usuário master pode alterar a data do pagamento");
    expect(migration).toContain("'entrada', 'estorno_conta_pagar'");
    expect(migration).toContain("'saida', 'conta_pagar'");
    expect(migration).toContain("'data_pagamento', v_pago_em_final IS DISTINCT FROM v.pago_em");
    expect(migration).toContain("pago_em_anterior");
    expect(migration).toContain("pago_em_novo");
    expect(migration).not.toMatch(/UPDATE public\.caixa_movimentos/i);
    expect(migration).not.toMatch(/DELETE FROM public\.caixa_movimentos/i);
  });

  it("não aceita data futura e não concede a RPC ao service role", () => {
    expect(migration).toContain("v_pago_em_final > current_date");
    expect(migration).toContain("FROM PUBLIC, anon, service_role");
    expect(migration).toContain("TO authenticated");
  });
});
