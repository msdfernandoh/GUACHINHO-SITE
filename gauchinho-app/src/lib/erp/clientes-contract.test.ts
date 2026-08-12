import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("../supabase/migrations/071_erp_clientes_operacional.sql");
const list = read("src/app/erp/clientes/page.tsx");
const detail = read("src/app/erp/clientes/[id]/page.tsx");

describe("contrato ERP Clientes", () => {
  it("cria identidade tenant-aware apenas por contratação assinada", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.clientes");
    expect(migration).toContain("NEW.contrato_assinado");
    expect(migration).toContain("ON CONFLICT (empresa_id, documento_normalizado)");
    expect(migration).toContain("normalizar_documento_cliente");
    expect(migration).not.toMatch(/INSERT INTO public\.clientes[\s\S]*WHERE contrato_assinado = true/i);
  });
  it("preserva fatos comerciais e conecta somente por FKs tenant-aware", () => {
    expect(migration).toContain("contratacoes_online_cliente_empresa_fkey");
    expect(migration).toContain("propostas_cliente_empresa_fkey");
    expect(migration).toContain("vendas_cliente_empresa_fkey");
    expect(migration).not.toMatch(/ALTER TABLE public\.cotas_definitivas/i);
    expect(migration).not.toMatch(/ALTER TABLE public\.grupos_cotas/i);
  });
  it("expõe RLS explícita e histórico sem exclusão destrutiva", () => {
    expect(migration).toContain("clientes_tenant_select");
    expect(migration).toContain("clientes_tenant_insert");
    expect(migration).toContain("clientes_tenant_update");
    expect(migration).not.toContain("FOR ALL TO authenticated");
    expect(migration).not.toContain("clientes_tenant_delete");
  });
  it("mostra somente clientes e cotas definitivas na UX", () => {
    expect(list).toContain('.from("clientes")');
    expect(list).not.toContain("Leads e CRM");
    expect(detail).toContain('.from("vendas")');
    expect(detail).toContain("Nova cota");
  });
});
