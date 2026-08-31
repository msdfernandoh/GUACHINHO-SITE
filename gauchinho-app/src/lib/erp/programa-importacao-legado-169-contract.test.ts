import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/169_programa_comissao_exclusivo_importacao_legado.sql"),
  "utf8",
);
const importerPage = readFileSync(
  resolve(process.cwd(), "src/app/erp/clientes/importar/page.tsx"),
  "utf8",
);
const importerActions = readFileSync(
  resolve(process.cwd(), "src/app/erp/clientes/importar/actions.ts"),
  "utf8",
);
const workspace = readFileSync(
  resolve(process.cwd(), "src/components/platform/programa-workspace.tsx"),
  "utf8",
);

describe("programa exclusivo para importação histórica", () => {
  it("isola o programa do motor canônico e mantém auditoria", () => {
    expect(migration).toContain("uso_exclusivo_importacao_legado boolean NOT NULL DEFAULT false");
    expect(migration).toContain("status = CASE");
    expect(migration).toContain("ativo = CASE");
    expect(migration).toContain("configuracao_homologada = false");
    expect(migration).toContain("platform_catalogo_auditar");
    expect(migration).toContain("Programa exclusivo de importação histórica não pode ser ativado");
  });

  it("expõe ação explícita sem confundir com homologação", () => {
    expect(workspace).toContain("Usar somente na importação histórica");
    expect(workspace).toContain("SOMENTE IMPORTAÇÃO HISTÓRICA");
    expect(workspace).toContain("isolado das novas vendas");
  });

  it("prioriza regras exclusivas e valida a vigência do contrato", () => {
    expect(importerPage).toContain("[SOMENTE IMPORTAÇÃO]");
    expect(importerPage).toContain("exclusivaImportacao");
    expect(importerActions).toContain("Contrato fora da vigência da regra");
    expect(importerActions).toContain("vigencia_inicio,vigencia_fim");
  });
});
