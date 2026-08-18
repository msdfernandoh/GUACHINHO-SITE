import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.resolve(process.cwd(), "../supabase/migrations/080_fix_sync_cliente_contratacao_historico.sql"),
  "utf8",
);

describe("migration 080 — ordem contratação, cliente e histórico", () => {
  it("mantém a sincronização da identidade no BEFORE e move o histórico para AFTER", () => {
    const beforeFunction = migration.match(
      /CREATE OR REPLACE FUNCTION public\.sync_cliente_from_contratacao\(\)[\s\S]*?END \$\$;/,
    )?.[0];
    expect(migration).toContain("NEW.cliente_id := v_cliente.id");
    expect(migration).toContain("AFTER INSERT OR UPDATE OF contrato_assinado, cliente_id");
    expect(beforeFunction).toBeTruthy();
    expect(beforeFunction).not.toContain("INSERT INTO public.clientes_historico");
  });

  it("torna o histórico idempotente e tenant-aware", () => {
    expect(migration).toContain("WHERE NOT EXISTS");
    expect(migration).toContain("h.empresa_id = NEW.empresa_id");
    expect(migration).toContain("h.contratacao_id = NEW.id");
    expect(migration).toContain("OLD.cliente_id IS NOT DISTINCT FROM NEW.cliente_id");
  });
});
