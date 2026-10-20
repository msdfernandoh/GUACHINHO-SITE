import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("isola os itens financeiros pela empresa do recebimento pai, conforme o schema", () => {
  const schema = readFileSync(resolve(process.cwd(), "../supabase/migrations/055_macrobloco_d_financeiro_caixa_repasses.sql"), "utf8");
  const item = schema.split("CREATE TABLE IF NOT EXISTS public.financeiro_recebimento_itens (")[1].split(");")[0];
  expect(item).toContain("recebimento_id UUID NOT NULL REFERENCES public.financeiro_recebimentos(id)");
  expect(item).not.toContain("empresa_id");
  const action = readFileSync(resolve(process.cwd(), "src/app/erp/fechamento-socios/actions.ts"), "utf8");
  const query = action.split('admin.from("financeiro_recebimento_itens")')[1].split("\n")[0];
  expect(query).toContain("recebimento:financeiro_recebimentos!inner(empresa_id)");
  expect(query).toContain('.eq("recebimento.empresa_id", empresaAtiva.id)');
  expect(query).not.toContain('.eq("empresa_id", empresaAtiva.id)');
});
