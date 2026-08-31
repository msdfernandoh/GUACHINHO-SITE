import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { grupoCreateIdempotencyKey, normalizeGrupoCodigo } from "./grupo-local-create";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
describe("cadastro idempotente de grupo local", () => {
  it("normaliza código e mantém a mesma chave nos reenvios", () => {
    const base = { empresaId: "empresa", administradoraId: "admin", tipoId: "tipo" };
    expect(normalizeGrupoCodigo(" 1553   imóvel ")).toBe("1553 IMÓVEL");
    expect(grupoCreateIdempotencyKey({ ...base, codigo: "1553 imóvel" }))
      .toBe(grupoCreateIdempotencyKey({ ...base, codigo: "  1553  IMÓVEL " }));
  });
  it("separa empresas, administradoras e tipos", () => {
    const original = grupoCreateIdempotencyKey({ empresaId: "a", administradoraId: "b", tipoId: "c", codigo: "1" });
    expect(grupoCreateIdempotencyKey({ empresaId: "x", administradoraId: "b", tipoId: "c", codigo: "1" })).not.toBe(original);
    expect(grupoCreateIdempotencyKey({ empresaId: "a", administradoraId: "x", tipoId: "c", codigo: "1" })).not.toBe(original);
    expect(grupoCreateIdempotencyKey({ empresaId: "a", administradoraId: "b", tipoId: "x", codigo: "1" })).not.toBe(original);
  });
  it("desabilita múltiplos envios e encaminha ao registro salvo", () => {
    const form = read("src/components/erp/group-catalog-form.tsx");
    expect(form).toContain("formAction, isPending");
    expect(form.match(/disabled=\{isPending\}/g)).toHaveLength(2);
    expect(form).toContain("router.replace(state.redirectTo)");
    const action = read("src/app/erp/grupos/actions.ts");
    expect(action).toContain("grupoCreateIdempotencyKey");
    expect(action).toContain("já foi cadastrado");
    expect(action).not.toContain("randomUUID");
  });
  it("protege concorrência no banco com lock transacional", () => {
    const sql = read("../supabase/migrations/166_grupo_local_idempotencia.sql");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("empresa_origem_id");
    expect(sql).toContain("upper(trim(g.codigo_grupo))");
    expect(sql).toContain("ERRCODE = '23505'");
  });
});
