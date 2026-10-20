import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("repasse da franquia — reabertura e conferência dos vínculos", () => {
  const conciliacao = read("src/components/erp/repasse-pdf-conciliacao.tsx");
  const recebimentos = read("src/components/erp/receipt-manager.tsx");
  const pagina = read("src/components/erp/erp-operational-pages.tsx");
  const actions = read("src/app/erp/repasse-franquia/actions.ts");

  it("reabre pelo recebimento o relatório de PDF correspondente", () => {
    expect(recebimentos).toContain("abrir-conciliacao-repasse");
    expect(recebimentos).toContain("r.repasse_importacao_id");
    expect(conciliacao).toContain('importacoes.find((item) => item.id === importacaoSelecionadaId)');
    expect(pagina).toContain("importacaoPorRecebimento");
  });

  it("permite alternar entre os relatórios carregados, sem ficar preso ao último", () => {
    expect(conciliacao).toContain("Relatórios já importados");
    expect(conciliacao).toContain("Abrir conferência");
    expect(conciliacao).toContain("Relatório em conferência");
    expect(conciliacao).toContain("abrirImportacao(event.target.value)");
    expect(conciliacao).toContain("importState.importacaoId");
    expect(pagina).toContain(".limit(100)");
  });

  it("o card Vinculados abre a lista com os valores de relatório e do livro financeiro", () => {
    expect(conciliacao).toContain("Vinculados · clique para conferir");
    expect(conciliacao).toContain("Valor do relatório");
    expect(conciliacao).toContain("Valor vinculado");
    expect(conciliacao).toContain("Salvar alteração");
    expect(pagina).toContain("valorVinculadoPorRecebimentoPrevisao");
  });

  it("não troca silenciosamente um vínculo que já virou fato financeiro", () => {
    const wrapper = read("../supabase/migrations/242_repasse_identificacao_cotas_apos_upload.sql");
    const atual = read("../supabase/migrations/322_repasse_cotas_existentes_e_competencia.sql");
    expect(actions).toContain('await db.rpc("rpc_vincular_item_repasse_com_cota"');
    expect(wrapper).toContain("public.rpc_corrigir_vinculo_item_repasse(");
    expect(atual).toContain("Nao e permitido trocar previsao com comissao ja paga");
    expect(atual).toContain("INSERT INTO public.erp_repasse_vinculo_correcoes");
    expect(atual).toContain("'REVERSAO'");
    expect(atual).not.toContain("UPDATE public.financeiro_recebimentos");
  });
});
