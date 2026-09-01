import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd(); const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
describe("repasse 200",()=>{const sql=read("../supabase/migrations/200_repasse_titulo_repetido_busca_e_complemento.sql");const ui=read("src/components/erp/repasse-pdf-conciliacao.tsx");
 it("completa baixa e comprova título anterior",()=>{expect(sql).toContain("rpc_completar_baixa_item_repasse");expect(sql).toContain("rpc_resolver_titulo_repasse_ja_baixado");expect(sql).toContain("TITULO_JA_BAIXADO");});
 it("oferece busca e resolução manual",()=>{expect(ui).toContain("Buscar título para vínculo");expect(ui).toContain("Título já baixado em outro relatório");expect(ui).toContain("previsoesPesquisadas");});
});
