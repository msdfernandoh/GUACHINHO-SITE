import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve(process.cwd(), "..", "supabase", "migrations");
const migration = (name: string) => fs.readFileSync(path.join(migrationsDir, name), "utf8");

const identity = migration("057_hardening_identidade_autorizacao_helpers.sql");
const rls = migration("058_hardening_rls_macroblocos_b_e.sql");
const integrity = migration("059_hardening_integridade_append_only.sql");
const hardening = `${identity}\n${rls}\n${integrity}`;

describe("hardening RLS pós-hotfix", () => {
  it("resolve Auth UUID pela função canônica e não pelo vínculo direto", () => {
    expect(identity).toContain("u.auth_user_id = auth.uid()");
    expect(hardening).not.toMatch(/empresa_usuarios[^;]+usuario_id\s*=\s*auth\.uid\(\)/s);
  });

  it("autoriza pelo papel N:N e mantém visualizador fora da escrita", () => {
    expect(identity).toContain("p.codigo IN ('admin_empresa', 'gestor', 'consultor', 'visualizador')");
    expect(identity).toContain("p.codigo = 'admin_empresa'");
    const writeFunction = identity.slice(identity.indexOf("can_write_tenant_internal"));
    expect(writeFunction).not.toContain("'visualizador'");
    expect(writeFunction).not.toContain("is_staff()");
  });

  it("preserva superadmin somente pelo papel PLATFORM real", () => {
    expect(identity).toContain("p.codigo = 'super_admin'");
    expect(identity).toContain("p.escopo = 'PLATFORM'");
    expect(identity).toContain("p.empresa_id IS NULL");
    expect(identity).not.toContain("usuarios.perfil");
  });

  it("endurece SECURITY DEFINER e grants", () => {
    expect(identity.match(/SECURITY DEFINER/g)?.length).toBe(7);
    expect(identity.match(/SET search_path = pg_catalog/g)?.length).toBe(7);
    expect(identity).toContain("REVOKE ALL ON FUNCTION public.current_usuario_id() FROM PUBLIC, anon");
    expect(identity).toContain("TO authenticated, service_role");
  });

  it("remove FOR ALL e cria policies por operação", () => {
    expect(rls).not.toMatch(/CREATE POLICY[^;]+FOR ALL/s);
    expect(rls).toContain("FOR SELECT TO authenticated");
    expect(rls).toContain("FOR INSERT TO authenticated");
    expect(rls).toContain("FOR UPDATE TO authenticated");
    expect(rls).toContain("FOR DELETE TO authenticated");
  });

  it("mantém caixa e auditoria somente SELECT/INSERT para authenticated", () => {
    expect(rls).toContain("v_append_only text[] := ARRAY['caixa_movimentos', 'audit_logs_central']");
    expect(rls).toContain("REVOKE UPDATE, DELETE ON TABLE public.%I FROM authenticated");
    expect(rls).toContain("GRANT SELECT, INSERT ON TABLE public.%I TO authenticated");
  });

  it("bloqueia update/delete de históricos também por trigger", () => {
    expect(integrity).toContain("trg_caixa_append_only BEFORE UPDATE OR DELETE");
    expect(integrity).toContain("trg_audit_log_append_only BEFORE UPDATE OR DELETE");
    expect(integrity).toContain("é append-only; registre reversão em novo lançamento");
  });

  it("valida referências cross-tenant nos macroblocos B-E", () => {
    for (const functionName of [
      "validate_comercial_tenant_integrity",
      "validate_comissao_tenant_integrity",
      "validate_financeiro_tenant_integrity",
      "validate_gestao_tenant_integrity",
    ]) {
      expect(integrity).toContain(functionName);
    }
  });

  it("não altera sorteios, percentuais ou FKs históricas", () => {
    expect(hardening).not.toContain("grupos_sorteios");
    expect(hardening).not.toContain("percentual_total_comissao");
    expect(hardening).not.toContain("percentual_comissao");
    expect(hardening).not.toContain("ON DELETE");
  });
});
