import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Contrato da Fase 181 - conciliação do PDF de repasse", () => {
  const root = path.resolve(process.cwd(), "..");
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/178_conciliacao_pdf_repasse_racon.sql"), "utf8");
  const actions = fs.readFileSync(path.join(process.cwd(), "src/app/erp/repasse-franquia/actions.ts"), "utf8");
  const view = fs.readFileSync(path.join(process.cwd(), "src/components/erp/repasse-pdf-conciliacao.tsx"), "utf8");

  it("isola importações e itens por empresa e impede duplicidade do PDF e da previsão", () => {
    expect(migration).toContain("UNIQUE (empresa_id, arquivo_hash)");
    expect(migration).toContain("erp_repasse_item_previsao_unica_idx");
    expect(migration).toContain("can_read_tenant_internal(empresa_id)");
    expect(migration).toContain("has_company_permission(p_empresa_id, 'gerenciar_financeiro')");
  });

  it("registra a entrada bruta sem liberar a comissão durante o upload", () => {
    expect(migration).toContain("rpc_registrar_recebimento_manual");
    expect(actions).toContain("importarRelatorioRepasseRaconAction");
    expect(view).toContain("Importar, registrar entrada e conciliar");
    expect(actions.slice(actions.indexOf("importarRelatorioRepasseRaconAction"), actions.indexOf("vincularItemRepasseManualAction"))).not.toContain("rpc_conciliar_recebimento_manual");
  });

  it("reorganiza regra alterada antes de confirmar e bloqueia divergências", () => {
    expect(migration).toContain("v_programa_atual IS DISTINCT FROM v_programa_previsao");
    expect(migration).toContain("rpc_gerar_previsoes_comissao_v2_antes_171");
    expect(migration).toContain("A regra vigente alterou o valor ou a parcela");
    expect(migration.indexOf("rpc_conciliar_recebimento_manual", migration.indexOf("rpc_confirmar_conciliacao_repasse"))).toBeGreaterThan(migration.indexOf("A regra vigente alterou o valor ou a parcela"));
  });
});
