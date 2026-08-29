import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("status canônico da Master Franquia", () => {
  const migration = read("supabase/migrations/158_fix_status_canonico_master_franquia.sql");
  const hub = read("gauchinho-app/src/components/platform/master-franquia-hub.tsx");
  const listing = read("gauchinho-app/src/app/platform/empresas/client.tsx");

  it("ativa, suspende e reativa com os valores aceitos por empresas", () => {
    expect(migration).toContain("SET status = 'ativo', ativo = true");
    expect(migration).toContain("SET status = 'suspenso', ativo = false");
    expect(migration).not.toMatch(/SET\s+status\s*=\s*'(ativa|suspensa)'/);
  });

  it("registra os mesmos valores canônicos na auditoria", () => {
    expect(migration).toContain("'status_novo', 'ativo'");
    expect(migration).toContain("'status_novo', 'suspenso'");
  });

  it("reconhece os estados canônicos no hub e na listagem", () => {
    expect(hub).toContain('statusNorm === "ativo"');
    expect(hub).toContain('statusNorm === "suspenso"');
    expect(listing).toContain('["ativo", "ativa"]');
    expect(listing).toContain('["suspenso", "suspensa"]');
  });
});
