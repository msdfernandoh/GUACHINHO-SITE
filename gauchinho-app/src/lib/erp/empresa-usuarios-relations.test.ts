import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("relações de empresa_usuarios com usuarios", () => {
  it("escolhe usuario_id explicitamente quando convidado_por também referencia usuarios", () => {
    const erpFiles = [
      "src/app/admin/usuarios/actions.ts",
      "src/app/erp/contas-pagar/page.tsx",
      "src/app/platform/usuarios/page.tsx",
      "src/app/platform/empresas/[id]/page.tsx",
    ];
    for (const file of erpFiles) {
      const contents = source(file);
      expect(contents).toContain("usuarios!empresa_usuarios_usuario_id_fkey");
      expect(contents).not.toContain("usuario:usuarios(");
    }
    const actions = source("src/app/platform/usuarios-actions.ts");
    expect(actions).not.toContain("usuario:usuarios!inner");
    expect(actions).toContain('.from("usuarios")');
    const platform = source("src/app/platform/[secao]/page.tsx");
    expect(platform).toContain(
      "empresa:empresas(nome_fantasia),usuario:usuarios!empresa_usuarios_usuario_id_fkey(nome)",
    );
  });
});
