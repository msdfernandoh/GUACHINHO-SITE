import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { serializeJsonLd } from "@/lib/seo/json-ld";
import { EMPRESA_B_ID } from "@/lib/administradoras/constants";

const root = path.resolve(process.cwd(), "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Hotfix de segurança Codex pós-Antigravity", () => {
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

  it("autoriza gestão pelo papel do vínculo tenant, não pelo perfil global legado", () => {
    const source = read("gauchinho-app/src/lib/gestao/api-access.ts");
    expect(source).toContain("evaluateGestaoMembership(vinculos, tenant.empresaId, mode)");
    expect(source).not.toContain("isMaster(usuario.perfil)");
    expect(source).not.toContain("isStaff(usuario.perfil)");
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

  it("conversão de vendas delega idempotência e isolamento ao RPC transacional", () => {
    const source = read("gauchinho-app/src/lib/vendas/vendas-service.ts");
    const migration = read("supabase/migrations/061_motor_comissoes_rpc_comercial.sql");
    expect(source).toContain('db.rpc("rpc_converter_contratacao_venda"');
    expect(source).toContain("await createClient()");
    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain('.from("vendas").insert');
    expect(migration).toContain("v_contratacao.empresa_id<>p_empresa_id");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("operacoes_idempotentes");
    expect(source).not.toContain("?? 100000");
    expect(source).not.toContain("?? 650");
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
