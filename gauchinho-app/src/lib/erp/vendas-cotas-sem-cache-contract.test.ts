import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const admin = fs.readFileSync(path.join(process.cwd(), "src/lib/supabase/admin.ts"), "utf8");
const vendas = fs.readFileSync(path.join(process.cwd(), "src/app/admin/vendas/page.tsx"), "utf8");
const modulo = fs.readFileSync(path.join(process.cwd(), "src/app/erp/[modulo]/page.tsx"), "utf8");

describe("Fase 190 — cotas atuais na tela de vendas", () => {
  it("permite consultas administrativas sem cache", () => {
    expect(admin).toContain("options?: { noStore?: boolean }");
    expect(admin).toContain('cache: "no-store"');
    expect(vendas).toContain("createAdminClient({ noStore: true })");
  });

  it("força a rota modular do ERP a renderizar dados atuais", () => {
    expect(modulo).toContain('export const dynamic = "force-dynamic"');
    expect(modulo).toContain("export const revalidate = 0");
  });
});
