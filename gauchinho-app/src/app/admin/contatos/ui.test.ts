import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("aparência de Meus contatos", () => {
  it("mantém a tabela clara com texto escuro no painel de tema escuro", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/admin/contatos/ui.tsx"), "utf8");
    expect(source).toContain('className="w-full min-w-[980px] text-left text-sm text-slate-800"');
    expect(source).toContain("bg-slate-100 text-slate-700");
    expect(source).toContain("bg-white text-slate-800 hover:bg-slate-50");
    expect(source).toContain("font-medium text-slate-900");
    expect(source).toContain("Clique em Empresa ou Profissão para classificar");
    expect(source).toContain("Todas as tags");
    expect(source).toContain("Adicionar tag");
    expect(source).toContain("Descartar");
    expect(source).toContain("discardContactAction");
    expect(source).toContain("Exibindo {firstItem}–{lastItem} de {total} contatos");
    expect(source).toContain("Página {page} de {totalPages}");
    expect(source).toContain("navigate({ ...filters, page: page + 1 })");
  });
});
