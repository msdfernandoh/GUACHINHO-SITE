import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "..", "supabase", "migrations", "153_grupos_regras_comerciais_informativas.sql"),
  "utf8",
);

describe("migration 153 — regras comerciais informativas", () => {
  it("reutiliza a coleção canônica de lances e adiciona somente a base ausente", () => {
    expect(migration).toContain("ALTER TABLE public.grupos_modalidades_lance");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS base_referencia");
    expect(migration).not.toContain("CREATE TABLE public.grupos_modalidades_lance");
  });

  it("preserva legado e modela X+1 somente quando configurado", () => {
    expect(migration).toContain("regra_integralizacao_parcela_reduzida IS NULL");
    expect(migration).toContain("assembleia_limite_parcela_reduzida");
    expect(migration).not.toMatch(/UPDATE public\.grupos_consorcio\s+SET regra_integralizacao_parcela_reduzida =/);
  });

  it("cria grupo local no ERP e promove o mesmo UUID após aprovação", () => {
    expect(migration).toContain("p_empresa_id, 'LOCAL', 'PENDENTE_PLATFORM'");
    expect(migration).toContain("SET origem_governanca='GLOBAL',status_governanca='GLOBAL',empresa_origem_id=NULL");
  });
});
