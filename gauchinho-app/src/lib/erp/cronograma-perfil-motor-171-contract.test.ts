import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "../supabase/migrations/171_cronograma_proprio_perfil_e_opcao_impostos.sql"), "utf8");

describe("motor 171 de cronograma próprio por perfil", () => {
  it("adiciona opção fiscal preservando o comportamento histórico", () => {
    expect(sql).toContain("aplicar_desconto_impostos boolean NOT NULL DEFAULT true");
    expect(sql).toContain("v_regra.seguir_cronograma_franquia AND v_regra.aplicar_desconto_impostos");
    expect(sql).toContain("CONTINUE;");
  });
  it("mantém tenant, perfil, programa, vigência e precedência na resolução", () => {
    for (const fragment of ["r.empresa_id = p_empresa_id", "r.perfil_id = v_perfil_id", "r.programa_id = v_regra_franquia.programa_id", "r.status = 'HOMOLOGADA'", "r.vigencia_inicio <= v_venda.data_venda::date", "v_count <> 1"]) {
      expect(sql).toContain(fragment);
    }
  });
  it("usa base líquida ou bruta conforme escolha explícita", () => {
    expect(sql).toContain("WHEN v_regra.aplicar_desconto_impostos THEN v_base_liquida");
    expect(sql).toContain("ELSE v_base_bruta");
    expect(sql).toContain("'aplicar_desconto_impostos',v_regra.aplicar_desconto_impostos");
  });
  it("gera cronograma próprio, calcula competência e deixa resíduo na última parcela", () => {
    expect(sql).toContain("jsonb_array_elements(v_regra.etapas_cronograma)");
    expect(sql).toContain("make_interval(months=>v_mes-1)");
    expect(sql).toContain("v_total_participante-v_soma_anterior");
    expect(sql).toContain("'modo','MANUAL'");
  });
  it("não recalcula participante com valor elegível ou pago", () => {
    expect(sql).toContain("COALESCE(p.valor_pago,0)>0 OR COALESCE(p.valor_elegivel,0)>0");
  });
  it("mantém a RPC pública endurecida e a implementação anterior inacessível", () => {
    expect(sql).toContain("auth.uid() IS NULL OR NOT public.has_company_permission");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.rpc_gerar_previsoes_comissao_v2_antes_171");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text) TO authenticated");
  });
  it("não contém mutação ou backfill de previsões históricas", () => {
    expect(sql).not.toMatch(/UPDATE public\.comissao_previsoes_(franquia|participantes)/);
  });
});
