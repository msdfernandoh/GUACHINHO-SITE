import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const raiz = path.resolve(process.cwd(), "..");
const migration = fs.readFileSync(
  path.join(raiz, "supabase/migrations/149_cadastro_master_endereco_e_bootstrap_responsavel.sql"),
  "utf8",
);
const actions = fs.readFileSync(
  path.join(process.cwd(), "src/app/platform/empresas/actions.ts"),
  "utf8",
);
const enderecoUi = fs.readFileSync(
  path.join(process.cwd(), "src/components/platform/empresa-endereco-fields.tsx"),
  "utf8",
);
const usuarioUi = fs.readFileSync(
  path.join(process.cwd(), "src/app/platform/usuarios/client.tsx"),
  "utf8",
);
const empresaDetail = fs.readFileSync(
  path.join(process.cwd(), "src/app/platform/empresas/[id]/page.tsx"),
  "utf8",
);
const primeiroResponsavel = fs.readFileSync(
  path.join(raiz, "supabase/migrations/151_primeiro_usuario_responsavel_automatico.sql"),
  "utf8",
);

describe("fase 149 — cadastro da Master e primeiro responsável", () => {
  it("mantém endereço estruturado em colunas próprias e RPCs auditáveis", () => {
    for (const coluna of ["cep", "endereco", "numero", "complemento", "bairro"]) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS ${coluna} text`);
    }
    expect(migration).toContain("'ATUALIZAR_DADOS_EMPRESA'");
    expect(actions).toContain("p_cep: cadastro.cep");
    expect(actions).toContain("validarCnpj");
  });

  it("busca CEP, mantém edição manual e normaliza documentos e telefones no servidor", () => {
    expect(enderecoUi).toContain("fetchEnderecoByCep");
    expect(enderecoUi).toContain('name="endereco"');
    expect(actions).toContain("sanitizeCnpj");
    expect(actions).toContain("sanitizeDigits");
    expect(actions).toContain("validarUfBr");
  });

  it("permite o bootstrap do responsável em empresa em treinamento sem afrouxar a governança", () => {
    expect(migration).toContain("WHERE id = p_empresa_id'");
    expect(migration).toContain("v_nova := replace(");
    expect(migration).toContain("IF v_nova = v_def THEN");
    expect(migration).toContain("rpc_platform_convidar_usuario(uuid,text,text,uuid,text[],boolean)");
    expect(migration).toContain("public.is_platform_superadmin()");
    expect(primeiroResponsavel).toContain("p_is_responsavel := true");
    expect(primeiroResponsavel).toContain("is_responsavel_principal = true");
    expect(usuarioUi).toContain("setConviteIsResponsavel((sel?.usuarios_ativos ?? 0) === 0)");
  });

  it("reconhece o responsável ativo na ficha da empresa em treinamento", () => {
    expect(empresaDetail).toContain("createAdminClient");
    expect(empresaDetail).toContain("isPlatformSuperadmin");
    expect(empresaDetail).not.toContain("email, ativo, ultimo_acesso");
    expect(empresaDetail).toContain("Não foi possível carregar os usuários da Master Franquia");
  });
});
