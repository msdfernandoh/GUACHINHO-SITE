import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../../../supabase/migrations/157_fix_ativacao_master_assinatura_rascunho.sql",
  ),
  "utf8",
);

describe("migration 157 — ativação da assinatura criada no onboarding", () => {
  it("aceita a assinatura RASCUNHO vinculada e a efetiva atomicamente", () => {
    expect(migration).toContain("status in ('ATIVA','TREINAMENTO','PENDENTE','RASCUNHO')");
    expect(migration).toContain("where id=v_assinatura.id");
    expect(migration).toContain("and status in ('TREINAMENTO','PENDENTE','RASCUNHO')");
    expect(migration).toContain("set status='ATIVA'");
  });

  it("preserva autorização, auditoria e bloqueios de prontidão", () => {
    expect(migration).toContain("public.is_platform_superadmin()");
    expect(migration).toContain("public.empresa_administradoras");
    expect(migration).toContain("public.empresa_usuarios");
    expect(migration).toContain("public.plataforma_auditoria");
    expect(migration).toContain("assinatura_status_anterior");
    expect(migration).toContain("set search_path=pg_catalog");
    expect(migration).toContain("revoke all on function public.rpc_platform_ativar_empresa(uuid) from public,anon,service_role");
  });
});
