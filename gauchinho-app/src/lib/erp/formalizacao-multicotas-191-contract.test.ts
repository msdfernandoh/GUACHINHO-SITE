import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "191_corrige_montante_formalizacao_multicotas.sql",
  ),
  "utf8",
);
const form = fs.readFileSync(
  path.join(
    process.cwd(),
    "src",
    "components",
    "erp",
    "contratacoes",
    "formalizacao-venda-form.tsx",
  ),
  "utf8",
);

describe("Fase 195 — reconciliação do montante na formalização multicotas", () => {
  it("usa produto canônico multiplicado pela quantidade e registra o ajuste", () => {
    expect(migration).toContain(
      "v_credito_total := round(v_opcao.valor_credito * p_quantidade_cotas, 2)",
    );
    expect(migration).toContain("'DADOS_COMERCIAIS_AJUSTADOS'");
    expect(migration).toContain("'valor_anterior', v_credito_total");
    expect(migration).toContain("'valor_corrigido'");
    expect(migration).toContain("credito_selecionado = v_credito_total");
    expect(form).toContain("valorCreditoUnitario * quantidadeCotas");
    expect(form).toContain("corrigido por produto × quantidade");
  });

  it("reconstrói as previsões sobre o total antes de distribuí-las pelas cotas", () => {
    expect(migration).toContain("public.rpc_gerar_previsoes_comissao_v2(");
    expect(migration).toContain("':credito-total-multicotas'");
    expect(migration).toContain("o trigger multicotas apenas distribui esse total");
    expect(migration).toContain("IF NOT COALESCE((v_core->>'reused')::boolean, false) THEN");
  });

  it("preserva a idempotência append-only e executa a alteração atomicamente", () => {
    expect(migration).toMatch(/^-- 191:[\s\S]*BEGIN;/);
    expect(migration).toContain("pg_get_functiondef");
    expect(migration).toContain("COMMIT;");
    expect(migration).not.toMatch(/DISABLE TRIGGER/i);
    expect(migration).not.toMatch(/DROP TRIGGER/i);
  });
});
