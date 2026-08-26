import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const sql = readFileSync(
  resolve(root, "supabase/migrations/129_financeiro_contas_recorrentes_duplicacao.sql"),
  "utf8",
);
const actions = readFileSync(
  resolve(process.cwd(), "src/app/erp/contas-pagar/actions.ts"),
  "utf8",
);
const ui = readFileSync(
  resolve(process.cwd(), "src/app/erp/contas-pagar/ui.tsx"),
  "utf8",
);

describe("migration 129 - contas recorrentes", () => {
  it("mantém série, índice e total com unicidade por empresa", () => {
    expect(sql).toContain("financeiro_contas_pagar_series");
    expect(sql).toContain("serie_recorrencia_id");
    expect(sql).toContain("recorrencia_indice");
    expect(sql).toContain("financeiro_contas_pagar_serie_indice_uidx");
  });

  it("cria ocorrências em transação e protege reenvios", () => {
    expect(sql).toContain("rpc_criar_contas_pagar_recorrentes");
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("v_repeticoes NOT BETWEEN 1 AND 120");
    expect(sql).toContain("make_interval(months => v_indice - 1)");
  });

  it("duplica somente meses futuros e não copia documento ou pagamento", () => {
    expect(sql).toContain("rpc_duplicar_conta_pagar_meses");
    expect(sql).toContain("make_interval(months => v_indice)");
    const duplicacao = sql.slice(sql.indexOf("rpc_duplicar_conta_pagar_meses"));
    expect(duplicacao).not.toContain("comprovante_url");
    expect(duplicacao).toContain("'aberta', NULL");
  });

  it("exige permissão financeira e referências do mesmo tenant", () => {
    expect(sql).toContain("has_company_permission(p_empresa_id, 'gerenciar_financeiro')");
    expect(sql).toContain("id = p_centro_custo_id AND empresa_id = p_empresa_id");
    expect(sql).toContain("id = p_conta_bancaria_id AND empresa_id = p_empresa_id");
    expect(sql).toContain("id = p_fornecedor_id AND empresa_id = p_empresa_id");
  });
});

describe("aplicação - recorrência e duplicação", () => {
  it("usa as RPCs e mantém fallback apenas para conta avulsa", () => {
    expect(actions).toContain('session.rpc("rpc_criar_contas_pagar_recorrentes"');
    expect(actions).toContain('session.rpc("rpc_duplicar_conta_pagar_meses"');
    expect(actions).toContain("if (!migrationPendente || repeticoes > 1)");
  });

  it("expõe controles claros na interface", () => {
    expect(ui).toContain("Repetir mensalmente como conta fixa");
    expect(ui).toContain("Duplicar para meses futuros");
    expect(ui).toContain("O comprovante não será copiado");
  });
});
