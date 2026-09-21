import { describe, expect, it } from "vitest";
import { leadsToCsv } from "@/lib/crm/csv-export";
import {
  MOTIVOS_PERDA,
  FUNNEL_STATUSES,
  CRM_MACRO_TIERS,
  getMacroTierByFase,
  isEtapaInMacroTier,
} from "@/lib/crm/constants";
import { buildLeadTimeline } from "@/lib/crm/timeline";
import { extrairValorParcelaLead } from "@/lib/crm/dashboard-query";

describe("CRM Fase 10", () => {
  it("export CSV escapa vírgulas", () => {
    const csv = leadsToCsv([
      {
        id: "1",
        created_at: "2026-01-01",
        nome: "João, Silva",
        whatsapp: "519999",
        email: null,
        cidade: "POA",
        origem: "simulador_consorcio",
        tipo_interesse: "consorcio",
        produto_interesse: "Imóvel",
        status: "Novo",
        temperatura: "Quente",
        srd_responsavel_id: null,
        srd_responsavel_nome: null,
        proxima_acao: null,
        data_proxima_acao: null,
        proximo_retorno_data: null,
        ultima_interacao_at: null,
        valor_estimado: 500000,
        valor_simulado: null,
        fechado: false,
      },
    ]);
    expect(csv).toContain('"João, Silva"');
  });

  it("motivos de perda e funil definidos", () => {
    expect(MOTIVOS_PERDA.length).toBeGreaterThanOrEqual(8);
    expect(FUNNEL_STATUSES).toContain("Proposta enviada");
  });

  it("timeline agrega criação e histórico", () => {
    const items = buildLeadTimeline({
      leadCreatedAt: "2026-01-01T12:00:00Z",
      leadOrigem: "manual",
      historico: [
        {
          id: "h1",
          created_at: "2026-01-02T12:00:00Z",
          acao: "lead_status_alterado",
          descricao: "ok",
        },
      ],
      eventos: [],
      atividades: [],
    });
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  describe("extrairValorParcelaLead", () => {
    it("retorna valor_parcela_fechamento quando informado", () => {
      const p = extrairValorParcelaLead({ valor_parcela_fechamento: 2500 });
      expect(p).toBe(2500);
    });

    it("retorna parcela de dados_simulacao.resultado quando disponível", () => {
      const p = extrairValorParcelaLead({
        dados_simulacao: { resultado: { parcela: 1850.5 } },
      });
      expect(p).toBe(1850.5);
    });

    it("calcula parcela estimada via crédito e prazo quando não há parcela explícita", () => {
      // 200.000 com prazo 200 meses e taxa 1.18 -> (200000 * 1.18) / 200 = 1180
      const p = extrairValorParcelaLead({
        valor_estimado: 200000,
        prazo_simulado: 200,
      });
      expect(p).toBe(1180);
    });

    it("retorna 0 para lead sem crédito", () => {
      const p = extrairValorParcelaLead({ valor_estimado: 0 });
      expect(p).toBe(0);
    });
  });

  describe("CRM_MACRO_TIERS & Navegação Interativa do Funil", () => {
    it("possui 4 níveis macro com etapas atribuídas", () => {
      expect(CRM_MACRO_TIERS.length).toBe(4);
      expect(CRM_MACRO_TIERS.map((t) => t.fase)).toEqual(["topo", "meio_sup", "meio_inf", "fundo"]);
      for (const tier of CRM_MACRO_TIERS) {
        expect(tier.etapasSlugs.length).toBeGreaterThan(0);
        expect(tier.nomeNivel).toBeTruthy();
        expect(tier.corHex).toMatch(/^#/);
      }
    });

    it("getMacroTierByFase resolve corretamente por slug ou fase", () => {
      expect(getMacroTierByFase("topo")?.nomeNivel).toBe("TOPO FUNIL");
      expect(getMacroTierByFase("meio_sup")?.nomeNivel).toBe("TOPO-MEIO");
      expect(getMacroTierByFase("meio_inf")?.nomeNivel).toBe("MEIO FUNIL");
      expect(getMacroTierByFase("fundo")?.nomeNivel).toBe("FUNDO FUNIL");
      expect(getMacroTierByFase("topo_funil")?.fase).toBe("topo");
      expect(getMacroTierByFase("inexistente")).toBeNull();
      expect(getMacroTierByFase(null)).toBeNull();
    });

    it("isEtapaInMacroTier identifica etapas de cada fase macro", () => {
      expect(isEtapaInMacroTier("novo_lead", "topo")).toBe(true);
      expect(isEtapaInMacroTier("contato_realizado", "topo")).toBe(true);
      expect(isEtapaInMacroTier("qualificado", "topo")).toBe(false);

      expect(isEtapaInMacroTier("qualificado", "meio_sup")).toBe(true);
      expect(isEtapaInMacroTier("reuniao_agendada", "meio_sup")).toBe(true);
      expect(isEtapaInMacroTier("reuniao_realizada", "meio_sup")).toBe(true);

      expect(isEtapaInMacroTier("proposta_enviada", "meio_inf")).toBe(true);
      expect(isEtapaInMacroTier("documentacao_cadastro", "meio_inf")).toBe(true);
      expect(isEtapaInMacroTier("boleto_enviado", "meio_inf")).toBe(true);

      expect(isEtapaInMacroTier("venda_fechada", "fundo")).toBe(true);
      expect(isEtapaInMacroTier("pos_venda", "fundo")).toBe(true);
    });
  });
});
