import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("aprovação resiliente e consolidação do grupo local", () => {
  it("não revalida uma chave natural que permaneceu inalterada", () => {
    const sql = read("supabase/migrations/167_consolidar_grupo_1553_e_aprovacao_resiliente.sql");
    expect(sql).toContain("OLD.empresa_origem_id IS DISTINCT FROM NEW.empresa_origem_id");
    expect(sql).toContain("OLD.administradora_id IS DISTINCT FROM NEW.administradora_id");
    expect(sql).toContain("OLD.origem_governanca IS DISTINCT FROM NEW.origem_governanca");
  });

  it("só remove o lote auditado quando não existe uso comercial", () => {
    const sql = read("supabase/migrations/167_consolidar_grupo_1553_e_aprovacao_resiliente.sql");
    expect(sql).toContain("v_principal constant uuid");
    expect(sql).toContain("Uma duplicata do grupo 1553 possui uso comercial");
    expect(sql).toContain("DELETE FROM public.catalogo_grupo_solicitacoes");
    expect(sql).toContain("DELETE FROM public.grupos_consorcio");
  });

  it("bloqueia reenvio da decisão e mostra a resposta do servidor", () => {
    const form = read("gauchinho-app/src/components/platform/solicitacao-grupo-decision-form.tsx");
    expect(form).toContain("useActionState");
    expect(form).toContain("disabled={pending}");
    expect(form).toContain('role="status"');
  });
});
