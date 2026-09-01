import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "../supabase/migrations/203_repasse_vinculo_atomico_e_titular_cnpj.sql",
  ),
  "utf8",
);

const action = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/erp/repasse-franquia/actions.ts"),
  "utf8",
);

describe("Fase 203 — vínculo canônico do repasse", () => {
  it("mantém uma razão append-only por linha do relatório", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.erp_repasse_item_baixas");
    expect(sql).toContain("trg_repasse_item_baixas_append_only");
    expect(sql).toContain("erp_repasse_item_conciliacao_canonica");
  });

  it("corrige vínculo, baixa e participantes em uma única RPC", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.rpc_corrigir_vinculo_item_repasse");
    expect(sql).toContain("sincronizar_item_repasse_canonico_203");
    expect(sql).toContain("recalcular_liquidacao_previsao_repasse_203");
    expect(action).toContain("Vínculo, baixa e comissões sincronizados");
    expect(action).not.toContain('db.rpc("rpc_completar_baixa_item_repasse"');
  });

  it("usa a razão social como titular contratual de vendas CNPJ", () => {
    expect(sql).toContain("trg_normalizar_titular_venda_cnpj_203");
    expect(sql).toContain("NEW.cliente_nome := trim(v_contratacao.razao_social)");
    expect(sql).toContain("'responsavel_contratual'");
  });

  it("repara somente as linhas auditadas do relatório identificado", () => {
    expect(sql).toContain("e819119f-9458-4bc1-8568-297d2e14a564");
    expect(sql).toContain("item.linha IN (19, 20, 21)");
  });
});

