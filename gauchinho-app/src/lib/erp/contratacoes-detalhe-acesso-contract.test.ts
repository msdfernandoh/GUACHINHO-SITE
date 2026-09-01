import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detalhe = readFileSync("src/app/erp/contratacoes/[id]/page.tsx", "utf8");
const lista = readFileSync("src/app/erp/contratacoes/page.tsx", "utf8");
const formulario = readFileSync("src/components/erp/contratacoes/formalizacao-venda-form.tsx", "utf8");

describe("acesso ao detalhe de contratações", () => {
  it("usa o mesmo guard do módulo e preserva formalização como permissão específica", () => {
    expect(detalhe).toContain('requireErpRouteAccess("contratacoes")');
    expect(detalhe).not.toContain('requireTenantPermission("formalizar_vendas")');
    expect(detalhe).toContain('permissoes.has("formalizar_vendas")');
    expect(detalhe).toContain("Acesso de conferência");
    expect(lista).toContain("Conferir contratação");
    expect(formulario).toContain("Sem permissão para formalizar");
  });
});
