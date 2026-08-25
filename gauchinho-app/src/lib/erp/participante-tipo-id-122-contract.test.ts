import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Migration 122 - Blindagem de Colunas e Triggers de Participantes", () => {
  it("deve conter colunas participante_tipo_id em todas as tabelas comerciais", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../../../supabase/migrations/122_fix_participante_tipo_id_columns_resilience.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("ALTER TABLE public.participantes_comerciais ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;");
    expect(sql).toContain("ALTER TABLE public.contratacoes_online ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;");
    expect(sql).toContain("ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;");
    expect(sql).toContain("ALTER TABLE public.venda_participantes ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;");
    expect(sql).toContain("ALTER TABLE public.comissao_regras_participantes ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;");
    expect(sql).toContain("ALTER TABLE public.comissao_previsoes_participantes ADD COLUMN IF NOT EXISTS participante_tipo_id uuid;");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.vendas_criar_participantes_comerciais()");
  });
});
