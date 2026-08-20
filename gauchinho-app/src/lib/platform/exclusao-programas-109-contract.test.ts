import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration109 = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/109_platform_autonomia_exclusao_programas.sql"),
  "utf8"
);

describe("Contrato de Autonomia para Exclusão de Programas e Regras (Migration 109)", () => {
  it("contém rpc_platform_excluir_programa atualizada com limpeza de dependências", () => {
    expect(migration109).toContain("CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_programa");
    expect(migration109).toContain("DELETE FROM public.comissao_regras_franquia WHERE programa_id = p_programa_id");
    expect(migration109).toContain("DELETE FROM public.comissao_programas WHERE id = p_programa_id");
  });

  it("contém rpc_platform_excluir_regra_programa para exclusão de regra", () => {
    expect(migration109).toContain("CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_regra_programa");
    expect(migration109).toContain("DELETE FROM public.comissao_regra_etapas WHERE regra_franquia_id = p_regra_id");
    expect(migration109).toContain("DELETE FROM public.comissao_regras_franquia WHERE id = p_regra_id");
  });
});
