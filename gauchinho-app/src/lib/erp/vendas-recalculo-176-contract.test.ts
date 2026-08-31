import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Contrato da Fase 179 - recálculo atômico e recuperação das previsões", () => {
  const root = path.resolve(process.cwd(), "..");
  const actions = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "erp", "vendas", "actions.ts"),
    "utf8",
  );
  const migration = fs.readFileSync(
    path.join(root, "supabase", "migrations", "176_reparar_previsoes_vendas_e_recalculo_atomico.sql"),
    "utf8",
  );
  const historicalMigration = fs.readFileSync(
    path.join(root, "supabase", "migrations", "177_restaurar_cronograma_historico_2_porcento.sql"),
    "utf8",
  );
  const action = actions.slice(
    actions.indexOf("export async function masterAtualizarVendaAction"),
    actions.indexOf("export async function cancelarCotaEstornoAction"),
  );

  it("executa o motor com a sessão autenticada e propaga falhas", () => {
    expect(actions).toContain('import { createClient } from "@/lib/supabase/server"');
    expect(action).toContain("const db = await createClient()");
    expect(action).toContain('db.rpc("rpc_gerar_previsoes_comissao_v2"');
    expect(action).toContain("if (recalculoError) throw new Error");
  });

  it("não remove previsões antes da transação canônica", () => {
    expect(action).not.toContain('.from("comissao_previsoes_participantes").delete()');
    expect(action).not.toContain('.from("comissao_previsoes_franquia").delete()');
  });

  it("repara somente as quatro vendas conhecidas e aborta diante de divergências", () => {
    expect(migration.match(/reparo_176:/g)).toHaveLength(1);
    expect(migration.match(/::uuid,/g)).toHaveLength(3);
    expect(migration).toContain("rpc_gerar_previsoes_comissao_v2_antes_171");
    expect(migration).toContain("comissao_gerar_previsoes_perfis_171");
    expect(migration).toContain("possui cronograma parcial");
    expect(migration).toContain("cota administrativa ativa");
  });

  it("restaura e valida o perfil e os totais históricos sem reativar a regra antiga", () => {
    expect(historicalMigration).toContain("perfil_principal_id = v_perfil_historico_id");
    expect(historicalMigration).toContain("v_count <> 23");
    expect(historicalMigration).toContain("round(v_total, 2) <> 34240.00");
    expect(historicalMigration).not.toContain("UPDATE public.comissao_regras_franquia");
    expect(historicalMigration).toContain("restauracao_historica_177");
    expect(historicalMigration).toContain("Existem valores elegíveis ou pagos");
  });
});
