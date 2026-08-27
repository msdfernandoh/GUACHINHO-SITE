import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/145_fix_convite_usuario_principal_franquia.sql"),
  "utf8",
);
const page = fs.readFileSync(
  path.join(process.cwd(), "src/app/platform/usuarios/page.tsx"),
  "utf8",
);
const client = fs.readFileSync(
  path.join(process.cwd(), "src/app/platform/usuarios/client.tsx"),
  "utf8",
);

describe("Fase 146 — cadastro seguro de usuário principal da franquia", () => {
  it("usa perfil legado aceito apenas como identidade-base", () => {
    expect(migration).toContain("'visualizador'");
    expect(migration).not.toMatch(/VALUES\s*\([\s\S]*?'consultor',\s*true\s*\)/);
  });

  it("bloqueia papel PLATFORM e papel customizado de outra empresa no banco", () => {
    expect(migration).toContain("v_papel.escopo <> 'COMPANY'");
    expect(migration).toContain("v_papel.empresa_id <> NEW.empresa_id");
    expect(migration).toContain("empresa_usuarios_validar_papel_tenant");
  });

  it("não oferece papel global da Platform na tela de franquias", () => {
    expect(page).toContain('.eq("escopo", "COMPANY")');
    expect(page).toContain('.eq("ativo", true)');
    expect(client).toContain("p.empresa_id === null || p.empresa_id === conviteEmpresaId");
  });

  it("mantém o modal aberto quando o cadastro falha", () => {
    expect(client).toContain('if (stateConvidar.status === "SUCCESS")');
    expect(client).toContain("action={actionConvidar}");
    expect(client).not.toContain("await actionConvidar(formData)");
  });

  it("ativa somente os convites da identidade autenticada", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.rpc_ativar_meus_convites()");
    expect(migration).toContain("u.auth_user_id = auth.uid()");
    expect(migration).toContain("eu.status = 'CONVIDADO'");
  });
});
