import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateProgramRule, validateProgram, type ProgramRule } from "./homologacao";

const migration = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/087_platform_programas_regras_editor.sql"),
  "utf8",
);
const actions = readFileSync(
  resolve(process.cwd(), "src/app/platform/administradoras-actions.ts"),
  "utf8",
);
const programaWorkspace = readFileSync(
  resolve(process.cwd(), "src/components/platform/programa-workspace.tsx"),
  "utf8",
);
const adminWorkspace = readFileSync(
  resolve(process.cwd(), "src/components/platform/administrator-workspace.tsx"),
  "utf8",
);

describe("Platform Programas & Regras Editor (Fase 087)", () => {
  describe("Migration 087 Contract", () => {
    it("declara rpc_platform_criar_programa com status RASCUNHO e versão 1", () => {
      expect(migration).toContain("CREATE OR REPLACE FUNCTION public.rpc_platform_criar_programa");
      expect(migration).toContain("'RASCUNHO'");
      expect(migration).toContain("comissao_programas");
    });

    it("declara rpc_platform_salvar_dados_programa protegendo programas homologados", () => {
      expect(migration).toContain("CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_dados_programa");
      expect(migration).toContain("Apenas programas em RASCUNHO podem ser alterados");
    });

    it("declara rpc_platform_salvar_regra_programa com suporte a etapas dinâmicas", () => {
      expect(migration).toContain("CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_regra_programa");
      expect(migration).toContain("comissao_regras_franquia");
      expect(migration).toContain("comissao_regra_etapas");
    });

    it("declara rpc_platform_gerar_regras_padrao_programa para auto-popular tipos e modalidades", () => {
      expect(migration).toContain("CREATE OR REPLACE FUNCTION public.rpc_platform_gerar_regras_padrao_programa");
      expect(migration).toContain("administradora_tipos");
      expect(migration).toContain("administradora_modalidades_comissao");
    });

    it("declara rpc_platform_excluir_regra_programa para excluir regras em rascunho", () => {
      expect(migration).toContain("CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_regra_programa");
      expect(migration).toContain("DELETE FROM public.comissao_regra_etapas");
      expect(migration).toContain("DELETE FROM public.comissao_regras_franquia");
    });
  });

  describe("Server Actions Contract", () => {
    it("exporta todas as server actions necessárias para criação e edição", () => {
      expect(actions).toContain("criarNovoProgramaPlatformAction");
      expect(actions).toContain("salvarDadosProgramaPlatformAction");
      expect(actions).toContain("salvarRegraProgramaPlatformAction");
      expect(actions).toContain("gerarRegrasPadraoProgramaPlatformAction");
      expect(actions).toContain("excluirRegraProgramaPlatformAction");
    });
  });

  describe("ProgramaWorkspace Client Component Contract", () => {
    it("inclui botões e modais de edição de programa e regras", () => {
      expect(programaWorkspace).toContain("Renomear Programa");
      expect(programaWorkspace).toContain("Gerar Regras Padrão");
      expect(programaWorkspace).toContain("+ Adicionar Regra");
      expect(programaWorkspace).toContain("Editar Regra & Cronograma");
      expect(programaWorkspace).toContain("RegraEditorModal");
      expect(programaWorkspace).toContain("Cronograma de Repasse / Parcelas");
    });

    it("inclui atalhos de preset para acelerar a montagem do cronograma", () => {
      expect(programaWorkspace).toContain("1x 100%");
      expect(programaWorkspace).toContain("2x Parcelas");
      expect(programaWorkspace).toContain("3x Parcelas");
      expect(programaWorkspace).toContain("Racon (Parcela + Contemplação)");
    });
  });

  describe("AdministratorWorkspace Contract", () => {
    it("inclui botão de + Novo Programa da Franqueadora na aba programas", () => {
      expect(adminWorkspace).toContain("+ Novo Programa da Franqueadora");
      expect(adminWorkspace).toContain("Novo Programa de Comissão");
      expect(adminWorkspace).toContain("novoProgramaAction");
    });
  });

  describe("Regras Financeiras de Validação de Homologação", () => {
    it("Valida corretamente programa vazio com 0 regras (impede homologação com motivo claro)", () => {
      const result = validateProgram([]);
      expect(result.ready).toBe(false);
      expect(result.issues).toContain("Programa sem regras cadastradas");
    });

    it("Valida corretamente regra com cronograma perfeito fechado em 4.00%", () => {
      const rule: ProgramRule = {
        id: "regra-1",
        tipo_administradora_id: "tipo-1",
        modalidade_comissao_id: "mod-1",
        percentual_total_comissao: 4.0,
        base_calculo: "credito",
        vigencia_inicio: "2026-01-01",
        etapas: [
          { ordem: 1, tipo_gatilho: "MES_RELATIVO", mes_relativo: 1, nome: "1ª Parcela", percentual_venda: 2.75 },
          { ordem: 2, tipo_gatilho: "CONTEMPLACAO", mes_relativo: null, nome: "Contemplação", percentual_venda: 1.25 },
        ],
      };
      const result = validateProgramRule(rule);
      expect(result.ready).toBe(true);
      expect(result.scheduled).toBe(4.0);
      expect(result.issues).toHaveLength(0);
    });

    it("Detecta divergência se o cronograma somar valor diferente da comissão total", () => {
      const rule: ProgramRule = {
        id: "regra-2",
        tipo_administradora_id: "tipo-1",
        modalidade_comissao_id: "mod-1",
        percentual_total_comissao: 4.0,
        base_calculo: "credito",
        vigencia_inicio: "2026-01-01",
        etapas: [
          { ordem: 1, tipo_gatilho: "MES_RELATIVO", mes_relativo: 1, nome: "1ª Parcela", percentual_venda: 2.5 },
        ],
      };
      const result = validateProgramRule(rule);
      expect(result.ready).toBe(false);
      expect(result.issues[0]).toContain("Cronograma soma 2.5%, mas a comissão total é 4%");
    });
  });
});
