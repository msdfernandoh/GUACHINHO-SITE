import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Fase 214 — exclusão operacional e recriação pelo repasse", () => {
  const root = path.resolve(process.cwd(), "..");
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/214_exclusao_operacional_repasse_recriacao_valores.sql"), "utf8");
  const ui = fs.readFileSync(path.join(process.cwd(), "src/components/erp/repasse-pdf-conciliacao.tsx"), "utf8");
  const service = fs.readFileSync(path.join(process.cwd(), "src/lib/comissoes/comissoes-service.ts"), "utf8");
  const minhas = fs.readFileSync(path.join(process.cwd(), "src/app/erp/minhas-comissoes/page.tsx"), "utf8");

  it("preserva a referência anterior ao reabrir a linha do PDF", () => {
    expect(sql).toContain("erp_repasse_preservar_referencia_exclusao_214");
    expect(sql).toContain("valor_participante_referencia");
    expect(sql).toContain("venda_excluida_id");
  });

  it("recria empresa e vendedor com valores explícitos e auditados", () => {
    expect(sql).toContain("rpc_lancar_item_repasse_corrigido_214");
    expect(sql).toContain("valor_relatorio_empresa");
    expect(sql).toContain("valor_comissao_participante");
  });

  it("remove previsões canceladas das telas operacionais", () => {
    expect(service).toContain('.neq("status", "cancelada")');
    expect(minhas).toContain('.neq("status", "cancelada")');
  });

  it("oferece busca pelo cliente dentro de cada vínculo", () => {
    expect(ui).toContain("function SearchablePrevisaoSelect");
    expect(ui).toContain("Digite o nome do cliente");
    expect(ui).toContain("Comissão correta do vendedor");
  });
});
