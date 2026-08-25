import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration120 = fs.readFileSync(
  path.resolve(process.cwd(), "../supabase/migrations/120_fix_resolucao_programa_franquia_comissao.sql"),
  "utf8"
);

describe("Fase 120 — Resolução Precisa de Programa da Franqueadora e Comissão no Motor V2", () => {
  it("busca o programa_id vinculado ao perfil do consultor participante", () => {
    expect(migration120).toContain("v_programa_principal_id");
    expect(migration120).toContain("SELECT r.programa_id, r.percentual_comissao");
    expect(migration120).toContain("FROM public.comissao_regras_participantes r");
  });

  it("prioriza as regras da franqueadora vinculadas ao programa do perfil selecionado", () => {
    expect(migration120).toContain("v_programa_principal_id IS NULL OR r.programa_id = v_programa_principal_id");
    expect(migration120).toContain("(v_programa_principal_id IS NOT NULL AND r.programa_id = v_programa_principal_id) DESC");
  });

  it("permite override explícito do percentual da franqueadora gravado na venda", () => {
    expect(migration120).toContain("v_venda.snapshot_venda->>'percentual_franqueadora'");
  });
});
