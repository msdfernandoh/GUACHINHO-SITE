import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), "..", relative), "utf8");

describe("fase 267 - programas visíveis e inativação de regras", () => {
  it("distingue regras de Imóvel e Veículo pelo nome do programa", () => {
    const view = source("gauchinho-app/src/components/erp/comissoes/erp-commission-hub-view.tsx");
    expect(view).toContain("Programa / Administradora / Tipo");
    expect(view).toContain('regra.programa_nome || "Programa não identificado"');
  });

  it("prioriza o estado inativo e oferece reativação", () => {
    const view = source("gauchinho-app/src/components/erp/comissoes/erp-commission-hub-view.tsx");
    expect(view).toContain('const isInativa = !regra.ativa || regra.status === "INATIVA"');
    expect(view).toContain('{isInativa ? "INATIVA"');
    expect(view).toContain("Reativar");
  });

  it("valida o resultado da alteração no servidor", () => {
    const actions = source("gauchinho-app/src/app/erp/regras-comissao/actions.ts");
    expect(actions).toContain('.select("id")');
    expect(actions).toContain('throw new Error("Regra não encontrada ou não pôde ser alterada.")');
  });
});
