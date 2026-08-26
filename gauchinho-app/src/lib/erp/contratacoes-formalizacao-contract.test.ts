import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("ERP Contratações — formalização V1", () => {
  const migration = read("supabase/migrations/081_erp_contratacoes_formalizacao_v1.sql");
  const action = read("gauchinho-app/src/app/erp/contratacoes/actions.ts");
  const list = read("gauchinho-app/src/app/erp/contratacoes/page.tsx");
  const detail = read("gauchinho-app/src/app/erp/contratacoes/[id]/page.tsx");

  it("reutiliza o motor canônico e não insere venda/cota diretamente", () => {
    expect(action).toContain("converterContratacaoEmVenda");
    expect(action).not.toMatch(/from\(["']vendas["']\)\.insert/);
    expect(action).not.toMatch(/from\(["']cotas_definitivas["']\)\.insert/);
    expect(migration).not.toMatch(/INSERT INTO public\.(vendas|cotas_definitivas)/i);
  });

  it("mantém idempotência e rastreabilidade contratação → venda → cota", () => {
    expect(action).toContain("erp-formalizacao:${contratacaoId}");
    expect(migration).toContain("contratacao_marcar_formalizada_por_venda");
    expect(migration).toContain("contratacoes_formalizacao_historico");
    expect(migration).toContain("Venda já existente para esta contratação");
  });

  it("protege tenant, documentos e pendências como regra de negócio", () => {
    expect(migration).toContain("can_write_tenant_internal(p_empresa_id)");
    expect(action).toContain('.eq("empresa_id", empresaAtiva.id)');
    expect(action).toContain("Documento obrigatório ausente");
    expect(action).toContain('status_operacional_erp: "PENDENCIA"');
  });

  it("entrega UI ERP própria sem exclusão destrutiva", () => {
    expect(list).toContain("Contratações para formalizar");
    expect(list).not.toMatch(/Excluir|deleteContratacaoAction/);
    expect(detail).toContain("Conferência operacional");
    expect(detail).toContain("Validação da comissão");
    expect(detail).toContain("nenhuma cópia será criada");
  });
});
