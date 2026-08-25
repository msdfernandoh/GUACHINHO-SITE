import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration121 = fs.readFileSync(
  path.resolve(process.cwd(), "../supabase/migrations/121_fix_auto_resolucao_tipo_grupo_formalizacao.sql"),
  "utf8"
);

describe("Fase 121 — Auto-resolução Resiliente de Tipo e Modalidade de Grupos", () => {
  it("executa backfill de tipo_administradora_id em grupos_consorcio", () => {
    expect(migration121).toContain("UPDATE public.grupos_consorcio g");
    expect(migration121).toContain("SET tipo_administradora_id =");
  });

  it("garante auto-resolução no trigger comissao_v2_enriquecer_venda sem bloquear nova venda", () => {
    expect(migration121).toContain("CREATE OR REPLACE FUNCTION public.comissao_v2_enriquecer_venda()");
    expect(migration121).toContain("v_grupo.tipo_administradora_id IS NULL");
    expect(migration121).toContain("UPDATE public.grupos_consorcio SET tipo_administradora_id");
  });

  it("garante auto-resolução em rpc_converter_contratacao_venda", () => {
    expect(migration121).toContain("CREATE OR REPLACE FUNCTION public.rpc_converter_contratacao_venda");
  });
});
