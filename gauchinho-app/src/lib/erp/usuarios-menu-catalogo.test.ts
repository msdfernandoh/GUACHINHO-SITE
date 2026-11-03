import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { ERP_ACCESS_ITEMS } from "./erp-acesso";

it("a constraint de menus aceita todo o catálogo oferecido no cadastro", () => {
  const sql = readFileSync(resolve(process.cwd(), "../supabase/migrations/20261103213453_alinhar_menus_erp_usuarios.sql"), "utf8");
  for (const item of ERP_ACCESS_ITEMS) expect(sql).toContain(`'${item.id}'`);
});
