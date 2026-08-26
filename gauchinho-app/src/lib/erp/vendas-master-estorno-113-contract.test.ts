import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Contrato da Migration 113 - Datas de Comissões, Curva de Estorno e Gestão Master de Vendas", () => {
  const root = path.resolve(process.cwd(), "..");
  const migrationPath = path.join(root, "supabase", "migrations", "113_fix_comissoes_participantes_datas_estorno_master.sql");
  const migrationContent = fs.readFileSync(migrationPath, "utf8");

  const vendasActionsPath = path.join(process.cwd(), "src", "app", "erp", "vendas", "actions.ts");
  const vendasActionsContent = fs.readFileSync(vendasActionsPath, "utf8");

  const contratacoesActionsPath = path.join(process.cwd(), "src", "app", "erp", "contratacoes", "actions.ts");
  const contratacoesActionsContent = fs.readFileSync(contratacoesActionsPath, "utf8");

  it("garante suporte a datas de parcelas personalizadas no banco e actions", () => {
    expect(migrationContent).toContain("data_primeira_parcela");
    expect(migrationContent).toContain("data_segunda_parcela");
    expect(migrationContent).toContain("participante_secundario_id");
    expect(contratacoesActionsContent).toContain("dataPrimeiraParcela");
    expect(contratacoesActionsContent).toContain("dataSegundaParcela");
  });

  it("garante RPCs para cancelamento com curva de estorno e ação master de exclusão/estorno", () => {
    expect(migrationContent).toContain("rpc_cancelar_cota_com_estorno");
    expect(migrationContent).toContain("rpc_master_excluir_ou_estornar_venda");
    expect(migrationContent).toContain("rpc_master_atualizar_dados_venda");
    expect(migrationContent).toContain("rpc_gerar_previsoes_comissao_v2");
  });

  it("garante proteção restrita a Master para exclusão/estorno e exigência do texto EXCLUIR", () => {
    expect(vendasActionsContent).toContain("isMaster");
    expect(vendasActionsContent).toContain('acao === "EXCLUIR" && confirmacao !== "EXCLUIR"');
    expect(vendasActionsContent).toContain("cancelarCotaEstornoAction");
    expect(vendasActionsContent).toContain("masterAtualizarVendaAction");
  });
});
