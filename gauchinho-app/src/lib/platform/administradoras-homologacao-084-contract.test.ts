import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateProgramRule, validateProgram, type ProgramRule } from "./homologacao";

const migration = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/084_fix_homologacao_programas_catalogo.sql"),
  "utf8",
);
const workspace = readFileSync(
  resolve(process.cwd(), "src/components/platform/administrator-workspace.tsx"),
  "utf8",
);
const actions = readFileSync(
  resolve(process.cwd(), "src/app/platform/administradoras-actions.ts"),
  "utf8",
);
const detailPage = readFileSync(
  resolve(process.cwd(), "src/app/platform/administradoras/[id]/programas/[programaId]/page.tsx"),
  "utf8",
);

describe("Platform Administradoras Homologação 084", () => {
  describe("Migration 084 Forward-Only Contract", () => {
    it("valida a soma das etapas contra o total da própria regra, e não 100%", () => {
      expect(migration).toContain("CASE WHEN v_invalida.base_calculo = 'valor_fixo' THEN v_invalida.valor_fixo_total ELSE v_invalida.percentual_total_comissao END");
      expect(migration).toContain("abs(v_invalida.soma_etapas - v_esperado) > 0.0001");
      expect(migration).not.toContain("percentual_venda),0) FROM public.comissao_regra_etapas e WHERE e.regra_franquia_id=r.id)-100");
    });

    it("emite mensagens de erro específicas por tipo de pendência", () => {
      expect(migration).toContain("Regra % possui Tipo não definido");
      expect(migration).toContain("Regra % possui Modalidade não definida");
      expect(migration).toContain("sem etapas de cronograma cadastradas");
      expect(migration).toContain("cronograma soma %, mas comissão total é %");
      expect(migration).toContain("Homologação bloqueada por regra canônica sobreposta");
    });

    it("protege o versionamento: rascunhos são editados diretamente e não geram versão duplicada", () => {
      expect(migration).toContain("IF v_old.status = 'RASCUNHO' THEN");
      expect(migration).toContain("Versão em rascunho pode ser editada diretamente sem criar nova versão");
      expect(migration).toContain("IF v_old.status = 'SUBSTITUIDO' THEN");
      expect(migration).toContain("Versão já substituída não pode gerar nova versão");
    });
  });

  describe("Regras Financeiras de Homologação (A-G)", () => {
    it("A) Automóveis Integral 3,5% com cronograma fracionado em 9 parcelas somando 3,5% -> HOMOLOGA", () => {
      const rule: ProgramRule = {
        id: "regra-auto-integral",
        tipo_administradora_id: "tipo-auto",
        modalidade_comissao_id: "mod-integral",
        percentual_total_comissao: 3.5,
        base_calculo: "credito",
        vigencia_inicio: "2026-01-01",
        etapas: [
          { ordem: 1, tipo_gatilho: "PARCELA", mes_relativo: 1, nome: "1ª Parcela", percentual_venda: 0.5 },
          { ordem: 2, tipo_gatilho: "PARCELA", mes_relativo: 2, nome: "2ª Parcela", percentual_venda: 0.25 },
          { ordem: 3, tipo_gatilho: "PARCELA", mes_relativo: 3, nome: "3ª Parcela", percentual_venda: 0.5 },
          { ordem: 4, tipo_gatilho: "PARCELA", mes_relativo: 4, nome: "4ª Parcela", percentual_venda: 0.5 },
          { ordem: 5, tipo_gatilho: "PARCELA", mes_relativo: 5, nome: "5ª Parcela", percentual_venda: 0.25 },
          { ordem: 6, tipo_gatilho: "PARCELA", mes_relativo: 6, nome: "6ª Parcela", percentual_venda: 0.25 },
          { ordem: 7, tipo_gatilho: "PARCELA", mes_relativo: 7, nome: "7ª Parcela", percentual_venda: 0.5 },
          { ordem: 8, tipo_gatilho: "PARCELA", mes_relativo: 8, nome: "8ª Parcela", percentual_venda: 0.25 },
          { ordem: 9, tipo_gatilho: "PARCELA", mes_relativo: 9, nome: "9ª Parcela", percentual_venda: 0.5 },
        ],
      };
      const result = validateProgramRule(rule);
      expect(result.ready).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.scheduled).toBeCloseTo(3.5, 4);
    });

    it("B) Automóveis Reduzida 60-99 3,5% com cronograma somando 3,5% -> HOMOLOGA", () => {
      const rule: ProgramRule = {
        id: "regra-auto-reduzida-60",
        tipo_administradora_id: "tipo-auto",
        modalidade_comissao_id: "mod-red-60",
        percentual_total_comissao: 3.5,
        base_calculo: "credito",
        vigencia_inicio: "2026-01-01",
        etapas: [
          { ordem: 1, tipo_gatilho: "PARCELA", mes_relativo: 1, nome: "Parcela inicial", percentual_venda: 2.0 },
          { ordem: 2, tipo_gatilho: "PARCELA", mes_relativo: 2, nome: "Parcela final", percentual_venda: 1.5 },
        ],
      };
      const result = validateProgramRule(rule);
      expect(result.ready).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("C) Automóveis abaixo de 59% (2,25% mensal + 1,25% contemplação = 3,5%) -> HOMOLOGA", () => {
      const rule: ProgramRule = {
        id: "regra-auto-reduzida-59",
        tipo_administradora_id: "tipo-auto",
        modalidade_comissao_id: "mod-red-59",
        percentual_total_comissao: 3.5,
        base_calculo: "credito",
        vigencia_inicio: "2026-01-01",
        etapas: [
          { ordem: 1, tipo_gatilho: "PARCELA", mes_relativo: 1, nome: "Mensal 1", percentual_venda: 1.25 },
          { ordem: 2, tipo_gatilho: "PARCELA", mes_relativo: 2, nome: "Mensal 2", percentual_venda: 1.0 },
          { ordem: 3, tipo_gatilho: "CONTEMPLACAO", mes_relativo: null, nome: "Na Contemplação", percentual_venda: 1.25 },
        ],
      };
      const result = validateProgramRule(rule);
      expect(result.ready).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.scheduled).toBeCloseTo(3.5, 4);
      expect(result.cronogramaSummary).toContain("2.25% parcelas + 1.25% contemplação = 3.5%");
    });

    it("D) Imóvel Integral 4% -> HOMOLOGA", () => {
      const rule: ProgramRule = {
        id: "regra-imovel-integral",
        tipo_administradora_id: "tipo-imovel",
        modalidade_comissao_id: "mod-integral",
        percentual_total_comissao: 4.0,
        base_calculo: "credito",
        vigencia_inicio: "2026-01-01",
        etapas: [
          { ordem: 1, tipo_gatilho: "PARCELA", mes_relativo: 1, nome: "Parcela 1", percentual_venda: 2.0 },
          { ordem: 2, tipo_gatilho: "PARCELA", mes_relativo: 2, nome: "Parcela 2", percentual_venda: 2.0 },
        ],
      };
      const result = validateProgramRule(rule);
      expect(result.ready).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("E) Regra com total 3,5% e cronograma somando 3,25% -> BLOQUEIA", () => {
      const rule: ProgramRule = {
        id: "regra-incompleta",
        tipo_administradora_id: "tipo-auto",
        modalidade_comissao_id: "mod-integral",
        percentual_total_comissao: 3.5,
        base_calculo: "credito",
        vigencia_inicio: "2026-01-01",
        etapas: [
          { ordem: 1, tipo_gatilho: "PARCELA", mes_relativo: 1, nome: "Parcela 1", percentual_venda: 2.0 },
          { ordem: 2, tipo_gatilho: "PARCELA", mes_relativo: 2, nome: "Parcela 2", percentual_venda: 1.25 },
        ],
      };
      const result = validateProgramRule(rule);
      expect(result.ready).toBe(false);
      expect(result.issues).toContain("Cronograma soma 3.25%, mas a comissão total é 3.5%");
    });

    it("F) Regra sem Tipo definido -> BLOQUEIA", () => {
      const rule: ProgramRule = {
        id: "regra-sem-tipo",
        tipo_administradora_id: null,
        modalidade_comissao_id: "mod-integral",
        percentual_total_comissao: 3.5,
        base_calculo: "credito",
        vigencia_inicio: "2026-01-01",
        etapas: [
          { ordem: 1, tipo_gatilho: "PARCELA", mes_relativo: 1, nome: "Parcela 1", percentual_venda: 3.5 },
        ],
      };
      const result = validateProgramRule(rule);
      expect(result.ready).toBe(false);
      expect(result.issues).toContain("Tipo não definido");
    });

    it("G) Regra sem Modalidade definida -> BLOQUEIA", () => {
      const rule: ProgramRule = {
        id: "regra-sem-modalidade",
        tipo_administradora_id: "tipo-auto",
        modalidade_comissao_id: null,
        percentual_total_comissao: 3.5,
        base_calculo: "credito",
        vigencia_inicio: "2026-01-01",
        etapas: [
          { ordem: 1, tipo_gatilho: "PARCELA", mes_relativo: 1, nome: "Parcela 1", percentual_venda: 3.5 },
        ],
      };
      const result = validateProgramRule(rule);
      expect(result.ready).toBe(false);
      expect(result.issues).toContain("Modalidade não definida");
    });
  });

  describe("UX e Ciclo de Vida de Versionamento", () => {
    it("valida programa completo em RASCUNHO com 3 modalidades", () => {
      const program = {
        status: "RASCUNHO",
        regras: [
          {
            id: "r1",
            tipo: { nome: "Automóveis" },
            modalidade: { nome: "Integral" },
            tipo_administradora_id: "t1",
            modalidade_comissao_id: "m1",
            percentual_total_comissao: 3.5,
            base_calculo: "credito" as const,
            vigencia_inicio: "2026-01-01",
            etapas: [{ percentual_venda: 3.5 }],
          },
          {
            id: "r2",
            tipo: { nome: "Automóveis" },
            modalidade: { nome: "Reduzida 60 a 99" },
            tipo_administradora_id: "t1",
            modalidade_comissao_id: "m2",
            percentual_total_comissao: 3.5,
            base_calculo: "credito" as const,
            vigencia_inicio: "2026-01-01",
            etapas: [{ percentual_venda: 3.5 }],
          },
          {
            id: "r3",
            tipo: { nome: "Automóveis" },
            modalidade: { nome: "Reduzida abaixo de 59" },
            tipo_administradora_id: "t1",
            modalidade_comissao_id: "m3",
            percentual_total_comissao: 3.5,
            base_calculo: "credito" as const,
            vigencia_inicio: "2026-01-01",
            etapas: [
              { tipo_gatilho: "PARCELA", mes_relativo: 1, percentual_venda: 2.25 },
              { tipo_gatilho: "CONTEMPLACAO", percentual_venda: 1.25 },
            ],
          },
        ],
      };
      const validation = validateProgram(program);
      expect(validation.mayHomologate).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it("UI expõe botão de homologação único por programa e exibe estado de pendência", () => {
      expect(workspace).toContain("Homologar versão {program.versao}");
      expect(workspace).toContain("disabled={!mayHomologate}");
      expect(workspace).toContain("SUBSTITUÍDA · HISTÓRICO");
      expect(workspace).toContain("Criar nova versão");
      expect(workspace).toContain("Excluir rascunho");
    });

    it("Server action de status retorna feedback de sucesso explícito", () => {
      expect(actions).toContain("Versão homologada com sucesso.");
      expect(actions).toContain("rpc_platform_status_programa");
      expect(actions).toContain("rpc_platform_nova_versao_programa");
    });

    it("Página de detalhe Platform-native apresenta metadados completos e tabela detalhada", () => {
      expect(detailPage).toContain("Platform · Programa oficial");
      expect(detailPage).toContain("Cronograma de Repasse");
      expect(detailPage).toContain("validateProgramRule");
    });
  });
});

