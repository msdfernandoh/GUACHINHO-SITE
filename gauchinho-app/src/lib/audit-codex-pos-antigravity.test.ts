import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { serializeJsonLd } from "@/lib/seo/json-ld";
import { EMPRESA_B_ID } from "@/lib/administradoras/constants";

const root = path.resolve(process.cwd(), "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Auditoria independente Codex pós-Antigravity", () => {
  it("neutraliza fechamento de script em JSON-LD persistido", () => {
    const payload = serializeJsonLd({ nome: "</script><script>alert(1)</script>" });
    expect(payload).not.toContain("<");
    expect(payload).toContain("\\u003c/script>");
  });

  it("usa o UUID canônico real da Empresa B", () => {
    expect(EMPRESA_B_ID).toBe("8e4e13f9-80e6-44db-a21b-584a43b6f024");
  });

  it("todas as seis APIs de gestão exigem o guard central e não hardcodam tenant", () => {
    const routes = ["dashboard", "relatorios", "auditoria", "equipes", "metas", "tarefas"];
    for (const route of routes) {
      const source = read(`gauchinho-app/src/app/api/admin/gestao/${route}/route.ts`);
      expect(source).toContain("requireGestaoApiAccess");
      expect(source).not.toContain("GAUCHINHO_EMPRESA_ID");
      expect(source).not.toContain("7170f38e-15dd-4b19-8588-51e9a9cf0d4c");
    }
  });

  it("handlers mutáveis aplicam proteção de origem e schema", () => {
    for (const route of ["equipes", "metas", "tarefas"]) {
      const source = read(`gauchinho-app/src/app/api/admin/gestao/${route}/route.ts`);
      expect(source).toContain("assertSameOrigin");
      expect(source).toContain(".parse(await req.json())");
    }
  });

  it("dashboards usam status e coluna existentes, sem métrica mockada", () => {
    const dashboard = read("gauchinho-app/src/lib/gestao/dashboards-service.ts");
    const metas = read("gauchinho-app/src/lib/gestao/metas-service.ts");
    for (const source of [dashboard, metas]) {
      expect(source).not.toContain('"efetivada"');
      expect(source).not.toContain("valor_previso\"");
      expect(source).toContain("valor_previsto");
    }
    expect(dashboard).not.toContain("Mock base");
  });

  it("idempotência de vendas é escopada ao tenant antes do retorno", () => {
    const source = read("gauchinho-app/src/lib/vendas/vendas-service.ts");
    const existingSaleQuery = source.indexOf('.eq("empresa_id", empresaId)');
    const existingSaleReturn = source.indexOf("if (vendaExistente)");
    expect(existingSaleQuery).toBeGreaterThan(-1);
    expect(existingSaleQuery).toBeLessThan(existingSaleReturn);
    expect(source).not.toContain("?? 100000");
    expect(source).not.toContain("?? 650");
  });

  it("migration 057 corrige identidade, visualizador e append-only sem tocar sorteios", () => {
    const migration = read("supabase/migrations/057_auditoria_codex_hardening_rls_integridade.sql");
    expect(migration).toContain("public.current_usuario_id()");
    expect(migration).toContain("u.perfil = 'master'");
    expect(migration).toContain("caixa_movimentos_append_only");
    expect(migration).toContain("audit_logs_central_append_only");
    expect(migration).not.toMatch(/grupos_sorteios_loteria_public_read/i);
    expect(migration).not.toMatch(/grupos_sorteio/i);
  });

  it("testes live não executam por padrão contra Produção", () => {
    const files = [
      "audit-macrobloco-b.test.ts",
      "audit-macrobloco-c.test.ts",
      "audit-macrobloco-d.test.ts",
      "audit-macrobloco-e.test.ts",
      "audit-macrobloco-f.test.ts",
      "audit-fase5-end-to-end.test.ts",
      "vendas/vendas-service.test.ts",
      "comissoes/comissoes-service.test.ts",
      "financeiro/financeiro-service.test.ts",
    ];
    for (const file of files) {
      expect(read(`gauchinho-app/src/lib/${file}`)).toContain("RUN_LIVE_PRODUCTION_AUDIT");
    }
  });
});
