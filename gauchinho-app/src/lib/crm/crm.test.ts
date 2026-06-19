import { describe, expect, it } from "vitest";
import { leadsToCsv } from "@/lib/crm/csv-export";
import { MOTIVOS_PERDA, FUNNEL_STATUSES } from "@/lib/crm/constants";
import { buildLeadTimeline } from "@/lib/crm/timeline";

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
});
