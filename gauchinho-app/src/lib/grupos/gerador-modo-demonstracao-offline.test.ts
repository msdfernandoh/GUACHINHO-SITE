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
});
