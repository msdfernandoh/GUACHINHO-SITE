import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("paginação de Meus contatos", () => {
  it("resolve filtros e página no servidor antes de renderizar a lista", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/admin/contatos/page.tsx"), "utf8");
    expect(source).toContain("searchParams: Promise");
    expect(source).toContain("listMyContacts(filters)");
    expect(source).toContain("listMyContactFilterOptions()");
    expect(source).toContain("total={result.total}");
  });
});
