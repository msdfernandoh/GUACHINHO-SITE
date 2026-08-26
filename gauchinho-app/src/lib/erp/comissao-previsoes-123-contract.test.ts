import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Migration 123 - Correção de papel_tipo e resolução de perfil de comissão", () => {
  it("deve conter colunas papel_tipo e previsao_franquia_id em comissao_previsoes_participantes", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../../../supabase/migrations/123_fix_comissao_previsoes_papel_tipo_e_perfil_resolucao.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("ALTER TABLE public.comissao_previsoes_participantes ADD COLUMN IF NOT EXISTS papel_tipo text;");
    expect(sql).toContain("ALTER TABLE public.comissao_previsoes_participantes ADD COLUMN IF NOT EXISTS previsao_franquia_id uuid;");
    expect(sql).toContain("ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS perfil_principal_id uuid");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.rpc_converter_contratacao_venda");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.rpc_gerar_previsoes_comissao_v2");
  });
});
