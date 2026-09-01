import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("contrato canônico de comissões e financeiro transacional", () => {
  const m060 = read("supabase/migrations/060_comissoes_modelo_canonico.sql");
  const m061 = read("supabase/migrations/061_motor_comissoes_rpc_comercial.sql");
  const m062 = read("supabase/migrations/062_rpc_financeiro_transacional.sql");
  const m063 = read("supabase/migrations/063_estornos_constraints_append_only.sql");

  it("não homologa percentuais legados nem introduz defaults comerciais", () => {
    expect(m060).toContain("configuracao_homologada boolean NOT NULL DEFAULT false");
    expect(m060).toContain("ALTER COLUMN percentual_total_comissao DROP DEFAULT");
    expect(m060).toContain("ALTER COLUMN percentual_comissao DROP DEFAULT");
    expect(m060).not.toMatch(/DEFAULT\s+4(?:\.0+)?\b/);
    expect(m060).not.toMatch(/DEFAULT\s+1\.5(?:0+)?\b/);
  });

  it("seleciona regras por administradora, vigência, compatibilidade e ambiguidade", () => {
    expect(m061).toContain("p.administradora_id = v_venda.administradora_id");
    expect(m061).toContain("r.vigencia_inicio <= v_venda.data_venda::date");
    expect(m061).toContain("r.opcao_cota_id IS NULL OR r.opcao_cota_id = v_venda.opcao_cota_id");
    expect(m061).toContain("Regras de franquia ambíguas");
    expect(m061).toContain("Regras de participante/parceiro ambíguas");
  });

  it("congela versão, regra e cronograma em snapshots", () => {
    expect(m061).toContain("comissao_regra_versionamento_guard");
    expect(m061).toContain("'versao',v_rf.versao");
    expect(m061).toContain("'cronograma',v_rf.etapas_cronograma");
    expect(m061).toContain("'precedencia',CASE");
  });

  it("mantém cálculo em numeric no PostgreSQL e distribui o último centavo", () => {
    expect(m061).toContain("numeric(15,2)");
    expect(m061).toContain("v_total - v_sum_etapas");
    expect(m062).toContain("round(p_valor_total,2)<>p_valor_total");
    expect(m062).toContain("round(p_valor_bruto,2)<>p_valor_bruto");
  });

  it("protege conversão, recebimento e pagamento com lock e idempotência", () => {
    for (const sql of [m061, m062, m063]) {
      expect(sql).toContain("pg_advisory_xact_lock");
      expect(sql).toContain("operacoes_idempotentes");
    }
    expect(m061).toContain("FOR UPDATE");
    expect(m062).toContain("FOR UPDATE");
  });

  it("limita pagamento ao caixa liquidado e nunca cria saída negativa", () => {
    expect(m062).toContain("valor_elegivel");
    expect(m062).toContain("Pagamento excede valor elegível");
    expect(m062).toContain("IF v_liquido<0");
    expect(m062).toContain("IF v_liquido>0 THEN");
  });

  it("registra estornos e compensações como eventos append-only", () => {
    expect(m060).toContain("financeiro_compensacao_movimentos");
    expect(m060).toContain("financeiro_estornos");
    expect(m063).toContain("block_append_only_mutation");
    expect(m063).toContain("reversao_consumo");
    expect(m063).toContain("estorno_recebimento");
    expect(m063).toContain("estorno_pagamento");
  });

  it("runtime usa somente RPCs nos caminhos críticos e strings decimais", () => {
    const financeiro = read("gauchinho-app/src/lib/financeiro/financeiro-service.ts");
    const vendas = read("gauchinho-app/src/lib/vendas/vendas-service.ts");
    const comissoes = read("gauchinho-app/src/lib/comissoes/comissoes-service.ts");
    expect(financeiro).toContain("export type ValorMonetario = string");
    expect(financeiro).toContain('rpc("rpc_registrar_recebimento"');
    expect(financeiro).toContain('"rpc_registrar_pagamento"');
    expect(financeiro).toContain('"rpc_registrar_pagamento_bancario"');
    expect(vendas).toContain('rpc("rpc_converter_contratacao_venda_multicotas"');
    expect(comissoes).toContain('rpc("rpc_gerar_previsoes_comissao"');
    expect(financeiro).not.toContain('.from("financeiro_pagamentos").insert');
  });
});
