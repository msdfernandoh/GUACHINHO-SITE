import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/128_financeiro_contas_pagar_hardening_privacidade_tenant.sql"),
  "utf8",
);
const actions = readFileSync(
  resolve(process.cwd(), "src/app/erp/contas-pagar/actions.ts"),
  "utf8",
);
const page = readFileSync(
  resolve(process.cwd(), "src/app/erp/contas-pagar/page.tsx"),
  "utf8",
);

describe("migration 128 - hardening de contas a pagar", () => {
  it("torna o bucket privado e remove a leitura pública legada", () => {
    expect(migration).toContain("public = false");
    expect(migration).toContain('DROP POLICY IF EXISTS "contas_pagar_documentos_public_read"');
    expect(migration).toContain("storage_can_read_conta_pagar_documento");
    expect(migration).toContain("storage_can_write_conta_pagar_documento");
  });

  it("isola os objetos pelo UUID da empresa no primeiro segmento", () => {
    expect(migration).toContain("split_part(p_name, '/', 1)::uuid");
    expect(migration).toContain("has_company_permission");
    expect(migration).toContain("'gerenciar_financeiro'");
  });

  it("bloqueia referências financeiras cruzadas entre tenants", () => {
    expect(migration).toContain("validar_referencias_conta_pagar_tenant");
    expect(migration).toContain("c.empresa_id = NEW.empresa_id");
    expect(migration).toContain("b.empresa_id = NEW.empresa_id");
    expect(migration).toContain("f.empresa_id = NEW.empresa_id");
    expect(migration).toContain("eu.empresa_id = NEW.empresa_id");
  });

  it("cria índices de período por empresa", () => {
    expect(migration).toContain("financeiro_contas_pagar_empresa_vencimento_status_idx");
    expect(migration).toContain("caixa_movimentos_empresa_data_idx");
  });
});

describe("aplicação - documentos e autorização financeira", () => {
  it("grava objeto privado sem sobrescrever e usa link assinado", () => {
    expect(actions).toContain("public: false");
    expect(actions).toContain("upsert: false");
    expect(actions).toContain("createSignedUrl(path, 60)");
    expect(actions).not.toContain("getPublicUrl(filePath)");
  });

  it("exige permissão tenant canônica e valida referências", () => {
    expect(actions).toContain('requireTenantPermission("gerenciar_financeiro")');
    expect(actions).toContain("assertTenantReference");
    expect(page).not.toContain('usuario?.perfil === "master"');
  });
});
