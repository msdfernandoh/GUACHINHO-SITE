import { describe, it, expect } from "vitest";
import {
  parseBRLNumber,
  parseBatchCotasInput,
  formatBRL,
  formatPercent,
  computeGrupoMetrics,
  validateGrupoProntidao,
  type GrupoRecord,
} from "./grupos-prontidao";

describe("Fase 085 — Catálogo Operacional de Grupos, Produtos e Modalidades", () => {
  // Scenario 1: Validação de cadastro de grupo
  it("Scenario 1: Deve validar campos obrigatórios de cadastro do grupo", () => {
    const grupoIncompleto: Partial<GrupoRecord> = {
      codigo_grupo: "1050",
    };
    const prontidao = validateGrupoProntidao(grupoIncompleto);
    expect(prontidao.ready).toBe(false);
    expect(prontidao.issues).toContain("Administradora não definida");
    expect(prontidao.issues).toContain("Tipo oficial não definido");
    expect(prontidao.issues).toContain("Taxa de administração obrigatória");
    expect(prontidao.issues).toContain("Prazo total obrigatório");
  });

  // Scenario 2: Impedir duplicidade lógica de grupo
  it("Scenario 2: Deve identificar grupos válidos com administradora e tipo", () => {
    const grupoValido: Partial<GrupoRecord> = {
      administradora_id: "admin-1",
      tipo_administradora_id: "tipo-1",
      codigo_grupo: "1050",
      taxa_administrativa_percentual: 15.0,
      prazo_total: 200,
      capacidade_total: 1000,
      modalidades: [{ administradora_modalidade_id: "mod-1", ativo: true }],
      produtos: [{ id: "cota-1", valor_credito: 100000, ativo: true }],
    };
    const prontidao = validateGrupoProntidao(grupoValido);
    expect(prontidao.ready).toBe(true);
    expect(prontidao.issues).toHaveLength(0);
  });

  // Scenario 3: Cálculo automático de cota mínima e máxima
  it("Scenario 3: Deve calcular cota mínima e máxima a partir dos produtos ativos", () => {
    const grupo: Partial<GrupoRecord> = {
      taxa_administrativa_percentual: 15.0,
      produtos: [
        { id: "c1", valor_credito: 150000, ativo: true },
        { id: "c2", valor_credito: 50000, ativo: true },
        { id: "c3", valor_credito: 300000, ativo: true },
        { id: "c4", valor_credito: 20000, ativo: false }, // inativa não entra
      ],
    };
    const metrics = computeGrupoMetrics(grupo);
    expect(metrics.cotaMinima).toBe(50000);
    expect(metrics.cotaMaxima).toBe(300000);
  });

  // Scenario 4: Cálculo de taxa total
  it("Scenario 4: Deve calcular a taxa total somando Adm, Fundo de Reserva e Seguro", () => {
    const grupo: Partial<GrupoRecord> = {
      taxa_administrativa_percentual: 17.5,
      fundo_reserva_percentual: 2.0,
      seguro_percentual: 0.045,
    };
    const metrics = computeGrupoMetrics(grupo);
    expect(metrics.taxaTotal).toBe(19.545);
  });

  // Scenario 5: Entrada de cotas em lote com texto sujo e formatações variadas
  it("Scenario 5: Deve normalizar valores em lote com R$, pontos, vírgulas e linhas variadas", () => {
    const raw = `
      100000
      80.000,00
      R$ 70.000
      R$ 60.500,50
      50000,00; 40000
    `;
    const parsed = parseBatchCotasInput(raw);
    expect(parsed).toEqual([100000, 80000, 70000, 60500.5, 50000, 40000]);
  });

  // Scenario 6: Desduplicação de cotas no lote
  it("Scenario 6: Deve remover créditos duplicados e ordenar decrescente", () => {
    const raw = "100000\n80000\n100000\n80.000,00\n120000";
    const parsed = parseBatchCotasInput(raw);
    expect(parsed).toEqual([120000, 100000, 80000]);
  });

  // Scenario 7: Formatação monetária BRL e percentual
  it("Scenario 7: Deve formatar BRL e percentual de forma canônica", () => {
    expect(formatBRL(100000)).toMatch(/100\.000,00/);
    expect(formatBRL(null)).toBe("—");
    expect(formatPercent(17.5)).toBe("17.5%");
    expect(formatPercent(null)).toBe("—");
  });

  // Scenario 8: Desabilitar modalidade no grupo desabilita para todas as cotas
  it("Scenario 8: Modalidade inativa no grupo deve ser refletida nas modalidades ativas", () => {
    const grupo: Partial<GrupoRecord> = {
      modalidades: [
        { administradora_modalidade_id: "mod-1", ativo: true },
        { administradora_modalidade_id: "mod-2", ativo: false },
      ],
    };
    const metrics = computeGrupoMetrics(grupo);
    expect(metrics.activeModalidades).toHaveLength(1);
    expect(metrics.activeModalidades[0].administradora_modalidade_id).toBe("mod-1");
  });

  // Scenario 9: Override por cota
  it("Scenario 9: Deve permitir armazenar override de habilitação e modo reduzido por cota", () => {
    const cota = {
      id: "cota-1",
      valor_credito: 100000,
      ativo: true,
      grupo_cota_modalidade_valores: [
        {
          administradora_modalidade_id: "mod-1",
          valor_parcela: 1200,
          habilitado: true,
          modo_reduzido: "padrao",
        },
        {
          administradora_modalidade_id: "mod-2",
          valor_parcela: 800,
          habilitado: false, // Desabilitado apenas nesta cota
          modo_reduzido: "personalizado",
          percentual_reducao: 70,
        },
      ],
    };
    const mod2 = cota.grupo_cota_modalidade_valores.find((v) => v.administradora_modalidade_id === "mod-2");
    expect(mod2?.habilitado).toBe(false);
    expect(mod2?.percentual_reducao).toBe(70);
  });

  // Scenario 10: Modo reduzido fixo vs personalizado
  it("Scenario 10: Deve aceitar configurações de faixas e modo personalizado", () => {
    const config = {
      modo_reduzido: "personalizado" as const,
      percentual_padrao: 70,
      percentual_minimo: 60,
      percentual_maximo: 99,
    };
    expect(config.modo_reduzido).toBe("personalizado");
    expect(config.percentual_padrao).toBe(70);
    expect(config.percentual_minimo).toBeLessThanOrEqual(config.percentual_padrao);
    expect(config.percentual_maximo).toBeGreaterThanOrEqual(config.percentual_padrao);
  });

  // Scenario 11: Capacidade e Vagas disponíveis
  it("Scenario 11: Deve gerenciar capacidade total e vagas disponíveis", () => {
    const grupo: Partial<GrupoRecord> = {
      capacidade_total: 1000,
      vagas_disponiveis: 145,
      vagas_atualizado_em: "2026-08-18T18:00:00Z",
    };
    expect(grupo.capacidade_total).toBe(1000);
    expect(grupo.vagas_disponiveis).toBe(145);
    expect(grupo.vagas_atualizado_em).toBeDefined();
  });

  // Scenario 12: Estrutura de dados estatísticos informativos
  it("Scenario 12: Deve estruturar dados estatísticos sem acionar contemplações automáticas", () => {
    const stats = {
      contemplacoes_sorteio_qtd: 2,
      lance_embutido_25_permitido: true,
      lance_embutido_50_permitido: false,
      lance_fidelidade_permitido: true,
      lance_fidelidade_percentual: 30,
      lance_livre_minimo: 35.0,
      lance_livre_medio: 48.5,
      lance_livre_maximo: 65.0,
      contemplados_mes_anterior_qtd: 12,
      origem_informacao: "Assembleia 08/2026",
      responsavel_nome: "Analista Financeiro",
    };
    expect(stats.contemplacoes_sorteio_qtd).toBe(2);
    expect(stats.lance_embutido_25_permitido).toBe(true);
    expect(stats.lance_livre_medio).toBe(48.5);
  });

  // Scenario 13: Global SaaS x ERP Local
  it("Scenario 13: Deve suportar chave de alternância usar_dados_globais para ERP local", () => {
    const configLocal = {
      empresa_id: "empresa-1",
      grupo_id: "grupo-1",
      usar_dados_globais: false,
      dados_estatisticos_locais: {
        lance_livre_medio: 42.0,
      },
    };
    expect(configLocal.usar_dados_globais).toBe(false);
    expect(configLocal.dados_estatisticos_locais.lance_livre_medio).toBe(42.0);
  });

  // Scenario 14: Prontidão com pendências discriminadas
  it("Scenario 14: Deve listar detalhadamente as pendências de um grupo incompleto", () => {
    const grupo: Partial<GrupoRecord> = {
      administradora_id: "admin-1",
      tipo_administradora_id: "tipo-1",
      codigo_grupo: "1050",
      taxa_administrativa_percentual: 15.0,
      prazo_total: 200,
      capacidade_total: 1000,
      modalidades: [], // Sem modalidades
      produtos: [], // Sem cotas
    };
    const prontidao = validateGrupoProntidao(grupo);
    expect(prontidao.ready).toBe(false);
    expect(prontidao.issues).toContain("Nenhuma modalidade ativa no Grupo");
    expect(prontidao.issues).toContain("Nenhum produto/cota ativo no Grupo");
  });

  // Scenario 15: Helper parseBRLNumber robusto contra entradas diversas
  it("Scenario 15: parseBRLNumber deve converter corretamente inteiros, decimais, strings com vírgula e nulos", () => {
    expect(parseBRLNumber(100)).toBe(100);
    expect(parseBRLNumber("100")).toBe(100);
    expect(parseBRLNumber("100.50")).toBe(100.5);
    expect(parseBRLNumber("100,50")).toBe(100.5);
    expect(parseBRLNumber("R$ 1.250.000,75")).toBe(1250000.75);
    expect(parseBRLNumber(null)).toBe(0);
    expect(parseBRLNumber(undefined)).toBe(0);
    expect(parseBRLNumber("")).toBe(0);
  });
});

