import { describe, expect, it } from "vitest";
import { generateModoDemonstracaoOfflineHtml } from "./gerador-modo-demonstracao-offline";
import type { PublicGrupoAggregate } from "@/lib/types";

const MOCK_AGGREGATES: PublicGrupoAggregate[] = [
  {
    grupo: {
      id: "grupo-1",
      codigo_grupo: "G-100",
      modalidade: "Imóvel",
      categorias_publicacao: ["Imóvel"],
      administradora: "Racon",
      taxa_administrativa_percentual: 18,
      fundo_reserva_percentual: 2,
      seguro_habilitado: true,
      seguro_percentual: 0.04,
      seguro_valor: null,
      tem_parcela_reduzida: true,
      percentual_parcela_reduzida: 70,
      permite_lance_embutido: true,
      percentual_lance_embutido: 25,
      percentual_recurso_proprio_sugerido: 20,
      prazo_total: 200,
      parcelas_realizadas: 10,
      prazo_restante: 190,
      seguro_pos_contemplacao: true,
      cet_percentual: null,
      status: "Ativo",
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    cotas: [
      {
        id: "cota-1",
        grupo_id: "grupo-1",
        valor_credito: 250000,
        valor_parcela: 1450,
        parcela_reduzida: 1015,
        parcela_integral: 1450,
        parcela_sem_seguro: 1350,
        parcela_com_seguro: 1450,
        ordem: 1,
        status: "Ativo",
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    modalidades: [
      {
        id: "mod-1",
        grupo_id: "grupo-1",
        nome: "25% Embutido",
        percentual_lance_embutido: 25,
        percentual_recurso_proprio_minimo: 20,
        base_referencia: "SALDO_DEVEDOR",
        descricao: null,
        ativo: true,
        ordem: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
];

describe("Modo Demonstração Offline — Gerador Multiempresa", () => {
  it("gera HTML completo e autônomo com a marca da Gauchinho Consórcios", () => {
    const html = generateModoDemonstracaoOfflineHtml({
      aggregates: MOCK_AGGREGATES,
      tenantBrand: {
        nome: "Gauchinho Consórcios",
        slug: "gauchinho",
        corPrimaria: "#0066cc",
        corSecundaria: "#0c2340",
        corDestaque: "#f59e0b",
      },
      timestamp: "08/09/2026 17:30",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Gauchinho Consórcios");
    expect(html).toContain("Modo Demonstração Offline");
    expect(html).toContain("--brand-primary: #0066cc;");
    expect(html).toContain("--brand-secondary: #0c2340;");
    expect(html).toContain("08/09/2026 17:30");
    expect(html).toContain("G-100");
    expect(html).toContain("250000");
    expect(html).toContain("window.print");
    expect(html).toContain("id=\"grupos-data\"");
  });

  it("garante isolamento multi-tenant para uma nova empresa parceira", () => {
    const html = generateModoDemonstracaoOfflineHtml({
      aggregates: MOCK_AGGREGATES,
      tenantBrand: {
        nome: "Parceiro Alfa Consórcios",
        slug: "alfa",
        corPrimaria: "#1e3a8a",
        corSecundaria: "#172554",
        corDestaque: "#10b981",
      },
      timestamp: "08/09/2026 18:00",
    });

    expect(html).toContain("Parceiro Alfa Consórcios");
    expect(html).toContain("--brand-primary: #1e3a8a;");
    expect(html).toContain("--brand-secondary: #172554;");
    expect(html).not.toContain("Gauchinho Consórcios");
  });

  it("escapa caracteres especiais para prevenir quebra de script ou injeção", () => {
    const html = generateModoDemonstracaoOfflineHtml({
      aggregates: MOCK_AGGREGATES,
      tenantBrand: {
        nome: "Empresa <script>alert(1)</script> & Cia",
        slug: "teste",
        corPrimaria: "#000",
        corSecundaria: "#fff",
      },
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("Empresa &lt;script&gt;alert(1)&lt;/script&gt; &amp; Cia");
  });

  it("define a função escapeHtml dentro do script cliente para evitar ReferenceError no navegador", () => {
    const html = generateModoDemonstracaoOfflineHtml({
      aggregates: MOCK_AGGREGATES,
      tenantBrand: {
        nome: "Gauchinho Consórcios",
        slug: "gauchinho",
      },
    });

    expect(html).toContain("function escapeHtml(str)");
    expect(html).toContain("id=\"initial-configs\"");
  });

  it("preenche initialConfigs para transferir cotas e lances já selecionados pelo usuário", () => {
    const html = generateModoDemonstracaoOfflineHtml({
      aggregates: MOCK_AGGREGATES,
      tenantBrand: {
        nome: "Gauchinho Consórcios",
        slug: "gauchinho",
      },
      initialConfigs: {
        "grupo-1": {
          cotaId: "cota-1",
          quantidadeCotas: 2,
          usaLanceEmbutido: true,
        },
      },
    });

    expect(html).toContain("\"cota-1\"");
    expect(html).toContain("\"quantidadeCotas\":2");
  });

  it("executa a renderização do script cliente no mock DOM sem erros e popula a tabela", () => {
    const html = generateModoDemonstracaoOfflineHtml({
      aggregates: MOCK_AGGREGATES,
      tenantBrand: {
        nome: "Gauchinho Consórcios",
        slug: "gauchinho",
      },
    });

    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const scriptCode = scriptMatch![1];

    const mockElements: Record<string, { textContent: string; innerHTML: string }> = {
      "grupos-data": { textContent: JSON.stringify(MOCK_AGGREGATES), innerHTML: "" },
      "tenant-data": { textContent: JSON.stringify({ nome: "Gauchinho" }), innerHTML: "" },
      "initial-configs": { textContent: "{}", innerHTML: "" },
      "tabelaCorpo": { textContent: "", innerHTML: "" },
      "totaisContador": { textContent: "", innerHTML: "" },
      "totaisCredito": { textContent: "", innerHTML: "" },
      "totaisLance": { textContent: "", innerHTML: "" },
      "totaisParcela": { textContent: "", innerHTML: "" },
      "totaisLiquido": { textContent: "", innerHTML: "" },
      "printSummary": { textContent: "", innerHTML: "" },
    };

    const mockDocument = {
      getElementById: (id: string) => mockElements[id] || null,
      querySelectorAll: () => [],
    };

    const runScript = new Function("document", "window", scriptCode);
    expect(() => runScript(mockDocument, {})).not.toThrow();
    expect(mockElements["tabelaCorpo"].innerHTML).toContain("G-100");
    expect(mockElements["tabelaCorpo"].innerHTML).toContain("250.000,00");
  });

  it("filtra corretamente grupos de veículo/automóvel pela aba Auto", () => {
    const veiculoAgg: PublicGrupoAggregate = {
      grupo: {
        id: "grupo-veiculo",
        codigo_grupo: "1071 VEÍCULO",
        modalidade: "Automóvel",
        categorias_publicacao: ["Auto"],
        administradora: "Racon",
        taxa_administrativa_percentual: 14,
        fundo_reserva_percentual: 1,
        seguro_habilitado: true,
        seguro_percentual: 0.0004,
        seguro_valor: null,
        tem_parcela_reduzida: true,
        percentual_parcela_reduzida: 60,
        permite_lance_embutido: true,
        percentual_lance_embutido: 25,
        percentual_recurso_proprio_sugerido: 0,
        prazo_total: 100,
        parcelas_realizadas: 10,
        prazo_restante: 90,
        seguro_pos_contemplacao: true,
        cet_percentual: null,
        status: "Disponível",
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      cotas: [
        {
          id: "cota-v1",
          grupo_id: "grupo-veiculo",
          valor_credito: 400000,
          valor_parcela: 2760,
          parcela_integral: 4600,
          parcela_reduzida: 2760,
          parcela_com_seguro: 2944,
          parcela_sem_seguro: 4600,
          saldo_devedor: 460000,
          ordem: 1,
          status: "Disponível",
          ativo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      modalidades: [],
    };

    const html = generateModoDemonstracaoOfflineHtml({
      aggregates: [veiculoAgg],
      tenantBrand: {
        nome: "Gauchinho Consórcios",
        slug: "gauchinho",
      },
    });

    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    const scriptCode = scriptMatch![1];
    const mockElements: Record<string, { textContent: string; innerHTML: string }> = {
      "grupos-data": { textContent: JSON.stringify([veiculoAgg]), innerHTML: "" },
      "tenant-data": { textContent: JSON.stringify({ nome: "Gauchinho" }), innerHTML: "" },
      "initial-configs": { textContent: "{}", innerHTML: "" },
      "tabelaCorpo": { textContent: "", innerHTML: "" },
      "totaisContador": { textContent: "", innerHTML: "" },
      "totaisCredito": { textContent: "", innerHTML: "" },
      "totaisLance": { textContent: "", innerHTML: "" },
      "totaisParcela": { textContent: "", innerHTML: "" },
      "totaisLiquido": { textContent: "", innerHTML: "" },
      "printSummary": { textContent: "", innerHTML: "" },
    };
    const mockWindow: Record<string, any> = {};
    const runScript = new Function("document", "window", scriptCode);
    runScript({ getElementById: (id: string) => mockElements[id] || null, querySelectorAll: () => [] }, mockWindow);

    expect(mockElements["tabelaCorpo"].innerHTML).toContain("1071 VEÍCULO");
    expect(mockElements["tabelaCorpo"].innerHTML).toContain("400.000,00");

    // Filtra categoria Auto
    mockWindow.filtrarCategoria("Auto");
    expect(mockElements["tabelaCorpo"].innerHTML).toContain("1071 VEÍCULO");

    // Filtra categoria Imóvel (não deve conter 1071 VEÍCULO)
    mockWindow.filtrarCategoria("Imóvel");
    expect(mockElements["tabelaCorpo"].innerHTML).not.toContain("1071 VEÍCULO");
  });
});
