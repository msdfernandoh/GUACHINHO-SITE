import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("repasse — central de atenção e releitura idempotente", () => {
  const ui = read("src/components/erp/repasse-pdf-conciliacao.tsx");
  const page = read("src/components/erp/erp-operational-pages.tsx");
  const actions = read("src/app/erp/repasse-franquia/actions.ts");
  const migration = read("../supabase/migrations/195_repasse_abas_atencao_resolucoes.sql");

  it("separa as três filas operacionais sem bloquear o recebimento", () => {
    expect(ui).toContain("Não vinculadas/cadastradas");
    expect(ui).toContain("No sistema, fora do relatório");
    expect(ui).toContain("Valores divergentes");
    expect(ui).toContain("Recebimento registrado · atenções não bloqueiam");
    expect(ui).not.toContain("Revalidar regras e confirmar recebimento");
  });

  it("oferece vínculo, cadastro, próximo relatório, crédito, ajuste e cancelamento", () => {
    expect(ui).toContain("Cadastrar cliente, grupo/cota e comissão");
    expect(ui).toContain("Manter para o próximo relatório");
    expect(ui).toContain("Considerar sistema e gerar crédito");
    expect(ui).toContain("Dar por ajustado");
    expect(ui).toContain("Cliente cancelou");
    for (const decision of ["AGUARDAR_PROXIMO", "GERAR_CREDITO", "AJUSTAR_DIFERENCA", "CANCELAR_COTA"]) {
      expect(migration).toContain(decision);
    }
    expect(migration).toContain("rpc_cancelar_cota_com_estorno");
  });

  it("registra as decisões de forma tenant-aware, append-only e idempotente", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.erp_repasse_atencao_resolucoes");
    expect(migration).toContain("UNIQUE (empresa_id, idempotency_key)");
    expect(migration).toContain("public.has_company_permission(p_empresa_id, 'gerenciar_financeiro')");
    expect(migration).not.toContain("UPDATE public.erp_repasse_atencao_resolucoes");
    expect(actions).toContain("rpc_resolver_atencao_repasse");
    expect(page).toContain('.from("erp_repasse_atencao_resolucoes")');
  });

  it("aceita o mesmo PDF para releitura e não recria importação nem recebimento", () => {
    expect(actions).toContain("result.idempotente && result.importacao_id");
    expect(actions).toContain("rpc_reprocessar_repasse_racon");
    expect(ui).toContain("Pode reenviar o mesmo PDF");
    expect(ui).toContain("Atualizar leitura");
    expect(migration).toContain("Somente linhas ainda");
    expect(migration).toContain("status_conciliacao IN ('ATENCAO','NAO_ENCONTRADO')");
    expect(migration).not.toContain("DELETE FROM public.erp_repasse_importacoes");
  });
});
