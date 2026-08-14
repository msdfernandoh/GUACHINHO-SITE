import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/076_erp_comissoes_grupos_contemplacao_v2.sql"), "utf8");

const sums = {
  imovelIntegral: [1,.5,.5,.5,.25,.25,.25,.5,.25],
  imovel6099: [.75,.5,.5,.5,.25,.25,.25,.5,.25,.25],
  imovelAbaixo59: [.5,.25,.25,.25,.25,.25,.5,.5,1.25],
  autoIntegral: [.75,.5,.5,.25,.25,.25,.5,.25,.25],
  auto6099: [.5,.25,.5,.5,.25,.25,.5,.25,.5],
  autoAbaixo59: [.5,.25,.25,.25,.25,.5,.25,1.25],
};

describe("contrato ERP comissões e contemplação V2", () => {
  it("fecha matematicamente as seis tabelas Racon", () => {
    const sum = (items: number[]) => items.reduce((total, value) => total + value, 0);
    expect(sum(sums.imovelIntegral)).toBe(4);
    expect(sum(sums.imovel6099)).toBe(4);
    expect(sum(sums.imovelAbaixo59)).toBe(4);
    expect(sum(sums.autoIntegral)).toBe(3.5);
    expect(sum(sums.auto6099)).toBe(3.5);
    expect(sum(sums.autoAbaixo59)).toBe(3.5);
  });

  it("insere contemplação somente abaixo de 59 e não usa mês fictício", () => {
    expect(migration).toContain("IF v_mod.codigo='REDUZIDA_ABAIXO_59'");
    expect(migration).toContain("'CONTEMPLACAO',NULL,'CONTEMPLAÇÃO',1.25");
    expect(migration).not.toMatch(/'CONTEMPLACAO'\s*,\s*(0|99)\s*,/);
  });

  it("preserva 060–063 por dispatcher e usa base original da venda", () => {
    expect(migration).toContain("RENAME TO rpc_gerar_previsoes_comissao_legado");
    expect(migration).toContain("RETURN public.rpc_gerar_previsoes_comissao_legado");
    expect(migration).toContain("v_venda.valor_credito*v_etapa.percentual_venda/100");
    expect(migration).toContain("valor_credito_contemplacao_historico");
  });

  it("protege retry e cross-tenant da contemplação", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("UNIQUE (cota_definitiva_id)");
    expect(migration).toContain("v_cota.empresa_id<>p_empresa_id");
    expect(migration).toContain("comissao_previsao_franquia_contemplacao_uidx");
  });

  it("assembleias permanecem fora do disparo de contemplação", () => {
    expect(migration).not.toContain("erp_assembleias_grupo");
    expect(migration).not.toContain("erp_assembleia_atencoes");
  });

  it("estende o 062 para parcial, divergência e pendência sem reescrevê-lo", () => {
    expect(migration).toContain("rpc_registrar_recebimento_com_divergencia");
    expect(migration).toContain("public.rpc_registrar_recebimento(");
    expect(migration).toContain("financeiro_divergencias_recebimento");
    expect(migration).toContain("rpc_transferir_pendencia_recebimento");
    expect(migration).toContain("competencia_original");
    expect(migration).toContain("'ajuste_caixa'");
  });

  it("suporta participante automático, manual e elegibilidade acumulada", () => {
    expect(migration).toContain("comissao_v2_gerar_participante_automatico");
    expect(migration).toContain("comissao_v2_gerar_participante_manual");
    expect(migration).toContain("fonte_total_potencial");
    expect(migration).toContain("comissao_v2_recalcular_elegibilidade_manual");
    expect(migration).toContain("'PARTICIPANTE_PRINCIPAL'");
  });

  it("aplica imposto antes da divisão e curva somente antes da contemplação", () => {
    expect(migration).toContain("empresa_configuracoes_fiscais");
    expect(migration).toContain("v_liquido:=v_bruto-v_tax");
    expect(migration).toContain("encerra_na_contemplacao");
    expect(migration).toContain("v_cota.contemplada");
    expect(migration).toContain("valor_efetivamente_recebido");
  });
});
