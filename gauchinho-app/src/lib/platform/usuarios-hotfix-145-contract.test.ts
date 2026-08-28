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
const actions = fs.readFileSync(
  path.join(process.cwd(), "src/app/platform/usuarios-actions.ts"),
  "utf8",
);
const loginActions = fs.readFileSync(
  path.join(process.cwd(), "src/app/(auth)/login/actions.ts"),
  "utf8",
);
const proxy = fs.readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");
const passwordActions = fs.readFileSync(
  path.join(process.cwd(), "src/app/definir-senha/actions.ts"),
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

  it("mantém o modal e exibe a senha inicial uma única vez", () => {
    expect(client).toContain("aceitarResultadoCadastro");
    expect(client).toContain("Copiar e-mail e senha");
    expect(client).toContain("action={actionConvidar}");
    expect(client).not.toContain("await actionConvidar(formData)");
  });

  it("lista identidades globais com leitura administrativa explícita", () => {
    expect(page).toContain("createAdminClient");
    expect(page).toContain("isPlatformSuperadmin");
    expect(page).toContain("Falha ao carregar usuários da Platform");
  });

  it("preserva a ativação autenticada dos convites legados", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.rpc_ativar_meus_convites()");
    expect(migration).toContain("u.auth_user_id = auth.uid()");
    expect(migration).toContain("eu.status = 'CONVIDADO'");
    expect(passwordActions).toContain('rpc("rpc_ativar_meus_convites")');
  });

  it("cria acesso direto sem convite ou recuperação por e-mail", () => {
    expect(actions).toContain("admin.auth.admin.createUser");
    expect(actions).toContain("gerarSenhaTemporaria");
    expect(actions).toContain('exige_troca_senha: true');
    expect(actions).toContain('update({ status: "ATIVO", ativo: true })');
    expect(actions).not.toContain("inviteUserByEmail");
    expect(actions).not.toContain("resetPasswordForEmail");
    expect(actions).toContain('rpc("rpc_platform_ativar_empresa"');
    expect(actions).toContain("empresaAtivada = true");
  });

  it("obriga a troca da senha inicial antes de liberar a navegação", () => {
    expect(loginActions).toContain("data.user.app_metadata?.exige_troca_senha === true");
    expect(proxy).toContain("user?.app_metadata?.exige_troca_senha === true");
    expect(proxy).toContain("Troque a senha inicial antes de continuar.");
    expect(passwordActions).toContain("exige_troca_senha: false");
  });
});
