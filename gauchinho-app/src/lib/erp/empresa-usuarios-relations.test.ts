import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("relações de empresa_usuarios com usuarios", () => {
  it("mapeia o perfil parceiro ao papel N:N de parceiro comercial", () => {
    const actions = source("src/app/admin/usuarios/actions.ts");
    expect(actions).toContain('parceiro: "parceiro_comercial"');
  });

  it("mantém o menu de fechamento entre os IDs aceitos pelo vínculo ERP", () => {
    const migration = source("../supabase/migrations/301_permitir_fechamento_socios_acesso_erp.sql");
    expect(migration).toContain("'conta-corrente-socios'");
    expect(migration).toContain("empresa_usuarios_erp_modulos_visiveis_check");
  });

  it("mantém a criação compatível enquanto a constraint antiga estiver no banco", () => {
    const actions = source("src/app/admin/usuarios/actions.ts");
    expect(actions).toContain("isLegacyErpClosingMenuConstraint");
    expect(actions).toContain('menu !== "conta-corrente-socios"');
  });

  it("leva parceiro comercial à área própria, sem conceder acesso ao Admin", () => {
    const adminLayout = source("src/app/admin/layout.tsx");
    expect(adminLayout).toContain('vinculoAtivo.papel?.codigo === "parceiro_comercial"');
    expect(adminLayout).toContain('redirect("/area-parceiro")');
  });

  it("escolhe usuario_id explicitamente quando convidado_por também referencia usuarios", () => {
    const relationFiles = [
      "src/app/admin/usuarios/actions.ts",
      "src/app/erp/contas-pagar/page.tsx",
      "src/app/platform/empresas/[id]/page.tsx",
    ];
    for (const file of relationFiles) {
      const contents = source(file);
      expect(contents).toContain("usuarios!empresa_usuarios_usuario_id_fkey");
      expect(contents).not.toContain("usuario:usuarios(");
    }
    const usuariosPage = source("src/app/platform/usuarios/page.tsx");
    expect(usuariosPage).toContain('.from("usuarios").select("id, nome, email")');
    expect(usuariosPage).toContain("usuariosPorId");
    expect(usuariosPage).toContain("r.usuario_id");
    expect(usuariosPage).not.toContain("usuario:usuarios(");
    const actions = source("src/app/platform/usuarios-actions.ts");
    expect(actions).not.toContain("usuario:usuarios!inner");
    expect(actions).toContain('.from("usuarios")');
    const platform = source("src/app/platform/[secao]/page.tsx");
    expect(platform).toContain(
      "empresa:empresas(nome_fantasia),usuario:usuarios!empresa_usuarios_usuario_id_fkey(nome)",
    );
  });
});
