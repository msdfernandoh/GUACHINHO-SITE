import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/168_formalizacao_venda_multiplas_cotas.sql"),
  "utf8",
);
const page = fs.readFileSync(
  path.join(process.cwd(), "src/app/erp/contratacoes/[id]/page.tsx"),
  "utf8",
);
const service = fs.readFileSync(
  path.join(process.cwd(), "src/lib/vendas/vendas-service.ts"),
  "utf8",
);

describe("formalização com múltiplas cotas", () => {
  it("usa o status canônico da concessão de administradora", () => {
    expect(page).toContain('.eq("status", "ATIVA")');
    expect(page).not.toContain('.from("empresa_administradoras")\n      .select("administradora_id")\n      .eq("empresa_id", empresaAtiva.id)\n      .eq("ativo", true)');
  });

  it("mantém uma venda e libera a cardinalidade 1:N de cotas", () => {
    expect(migration).toContain("DROP INDEX IF EXISTS public.cotas_definitivas_venda_uidx");
    expect(migration).toContain("cotas_definitivas_venda_ordem_uidx");
    expect(migration).toContain("rpc_converter_contratacao_venda_multicotas");
    expect(migration).toContain("public.rpc_converter_contratacao_venda(");
  });

  it("o servidor chama somente a extensão autenticada e exige a quantidade esperada", () => {
    expect(service).toContain('db.rpc("rpc_converter_contratacao_venda_multicotas"');
    expect(service).toContain("result.cotasDefinitivas.length !== quantidadeCotas");
    expect(migration).toContain("has_company_permission(p_empresa_id, 'formalizar_vendas')");
    expect(migration).toContain("Quantidade de cotas diverge da proposta aceita");
  });
});
