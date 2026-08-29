import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("publicação do site na ativação da Master Franquia", () => {
  const migration = read("supabase/migrations/159_publica_site_na_ativacao_master.sql");
  const hub = read("gauchinho-app/src/components/platform/master-franquia-hub.tsx");

  it("exige domínio principal ativo e verificado", () => {
    expect(migration).toContain("principal = true");
    expect(migration).toContain("ativo = true");
    expect(migration).toContain("verificado = true");
    expect(hub).toContain("dominioPrincipalPublicavel");
  });

  it("publica branding e vínculo do modelo na mesma ativação", () => {
    expect(migration).toContain("UPDATE public.empresa_branding");
    expect(migration).toContain("SET status_publicacao = 'PUBLICADO'");
    expect(migration).toContain("UPDATE public.empresa_site_modelos");
    expect(migration).toContain("SET status = 'PUBLICADO'");
  });

  it("reconcilia somente empresas já ativas e prontas para publicação", () => {
    expect(migration).toContain("e.status = 'ativo' AND e.ativo = true");
    expect(migration).toContain("eb.status_publicacao = 'RASCUNHO'");
    expect(migration).toContain("esm.status = 'RASCUNHO'");
  });
});
