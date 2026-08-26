import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Migration 124 - Correção de base_calculo_valor e defaults em comissao_previsoes_participantes", () => {
  it("deve conter defaults de base_calculo_valor e inserções completas", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../../../supabase/migrations/124_fix_comissao_previsoes_base_calculo_e_defaults.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("ALTER TABLE public.comissao_previsoes_participantes ALTER COLUMN base_calculo_valor SET DEFAULT 0;");
    expect(sql).toContain("ALTER TABLE public.comissao_previsoes_participantes ALTER COLUMN nome_etapa SET DEFAULT 'Parcela Única';");
    expect(sql).toContain("ALTER TABLE public.comissao_previsoes_franquia ALTER COLUMN base_calculo_valor SET DEFAULT 0;");
    expect(sql).toContain("base_calculo_valor");
    expect(sql).toContain("'reparticao_comercial', 'aplicada'");
  });
});
