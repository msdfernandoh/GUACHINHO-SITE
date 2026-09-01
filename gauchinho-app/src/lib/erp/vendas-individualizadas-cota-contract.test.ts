import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const view = fs.readFileSync(path.join(process.cwd(), "src/components/erp/vendas/erp-vendas-hub-view.tsx"), "utf8");
const page = fs.readFileSync(path.join(process.cwd(), "src/app/admin/vendas/page.tsx"), "utf8");

describe("Fase 188 — vendas individualizadas por cota", () => {
  it("materializa uma linha visual para cada cota definitiva", () => {
    expect(view).toContain("vendasFiltradas.flatMap");
    expect(view).toContain("cotasDaVenda.map");
    expect(view).toContain("Vendas individualizadas por cota");
  });

  it("usa os valores e ações da cota, não o agregado da venda", () => {
    expect(view).toContain("cota?.valor_credito ?? v.valor_credito");
    expect(view).toContain("cota?.parcela ?? v.parcela");
    expect(view).toContain("Definir número da cota");
    expect(view).toContain("setCancelandoCota(cota)");
  });

  it("não reutiliza uma resposta em cache para a listagem operacional", () => {
    expect(page).toContain("unstable_noStore as noStore");
    expect(page).toContain("noStore();");
  });
});
