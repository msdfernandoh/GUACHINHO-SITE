import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration107 = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/107_comissao_perfis_governanca_completa.sql"),
  "utf8"
);

describe("Contrato de Governança de Perfis e Regras de Comissão (Migration 107)", () => {
  it("cria a tabela de perfis de comissão com isolamento multi-tenant", () => {
    expect(migration107).toContain("CREATE TABLE IF NOT EXISTS public.comissao_perfis");
    expect(migration107).toContain("papel_base text NOT NULL");
    expect(migration107).toContain("comissao_perfis_tenant_isolation");
  });

  it("insere perfis padrão canônicos da franqueadora", () => {
    expect(migration107).toContain("Microfranquia Padrão");
    expect(migration107).toContain("Consultor Padrão");
    expect(migration107).toContain("SDR Padrão");
    expect(migration107).toContain("Indicador Padrão");
    expect(migration107).toContain("Parceiro Padrão");
  });

  it("evolui comissao_regras_participantes com perfil_id e governança de status", () => {
    expect(migration107).toContain("ADD COLUMN IF NOT EXISTS perfil_id uuid");
    expect(migration107).toContain("ADD COLUMN IF NOT EXISTS curva_estorno_id uuid");
    expect(migration107).toContain("ADD COLUMN IF NOT EXISTS aplicar_curva_estorno boolean");
    expect(migration107).toContain("ADD COLUMN IF NOT EXISTS seguir_cronograma_franquia boolean");
    expect(migration107).toContain("ADD COLUMN IF NOT EXISTS status text");
    expect(migration107).toContain("CHECK (status IN ('RASCUNHO','HOMOLOGADA','SUBSTITUIDA','INATIVA'))");
  });

  it("cria a tabela de vínculo participante_comissao_perfis com suporte a múltiplos papéis e override", () => {
    expect(migration107).toContain("CREATE TABLE IF NOT EXISTS public.participante_comissao_perfis");
    expect(migration107).toContain("participante_id uuid NOT NULL");
    expect(migration107).toContain("papel_tipo text NOT NULL");
    expect(migration107).toContain("perfil_id uuid NOT NULL");
    expect(migration107).toContain("override_percentual numeric(7,4)");
    expect(migration107).toContain("participante_comissao_perfis_tenant_isolation");
  });

  it("realiza reload seguro do schema do PostgREST ao final", () => {
    expect(migration107).toContain("NOTIFY pgrst, 'reload schema';");
  });
});
