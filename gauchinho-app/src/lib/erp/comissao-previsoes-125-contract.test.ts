import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Migration 125 - Resolução estrita do crédito da cota e recálculo do Juliano", () => {
  it("deve conter a resolução de v_opcao e recálculo da venda do Juliano para 212k", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../../../supabase/migrations/125_fix_conversao_credito_cota_e_correcao_juliano.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("v_credito := v_opcao.valor_credito;");
    expect(sql).toContain("v_parcela := v_opcao.valor_parcela;");
    expect(sql).toContain("212000.00");
    expect(sql).toContain("JULIANO FERNANDES DE AVILA");
  });
});
