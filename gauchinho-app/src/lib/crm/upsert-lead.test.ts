import { describe, it, expect, vi } from "vitest";
import {
  normalizePhoneForLead,
  isValidBrazilianPhone,
  upsertLeadPorTelefone,
} from "./upsert-lead";

describe("upsert-lead - Normalização e Validação de Telefones", () => {
  it("normaliza telefones com DDI +55 e formatação visual para formato canônico", () => {
    expect(normalizePhoneForLead("+55 (66) 99912-6120")).toBe("66999126120");
    expect(normalizePhoneForLead("5566999126120")).toBe("66999126120");
    expect(normalizePhoneForLead("(66) 99912-6120")).toBe("66999126120");
    expect(normalizePhoneForLead("66 9 9912-6120")).toBe("66999126120");
  });

  it("normaliza telefones fixos de 10 dígitos com e sem DDI 55", () => {
    expect(normalizePhoneForLead("+55 (66) 3531-1000")).toBe("6635311000");
    expect(normalizePhoneForLead("556635311000")).toBe("6635311000");
    expect(normalizePhoneForLead("(66) 3531-1000")).toBe("6635311000");
  });

  it("trata valores nulos, vazios ou indefinidos com segurança", () => {
    expect(normalizePhoneForLead("")).toBe("");
    expect(normalizePhoneForLead(null)).toBe("");
    expect(normalizePhoneForLead(undefined)).toBe("");
  });

  it("valida telefones brasileiros válidos", () => {
    expect(isValidBrazilianPhone("+55 (66) 99912-6120")).toBe(true);
    expect(isValidBrazilianPhone("11987654321")).toBe(true);
    expect(isValidBrazilianPhone("6635311000")).toBe(true);
  });

  it("rejeita telefones com formato ou DDDs inválidos", () => {
    expect(isValidBrazilianPhone("12345")).toBe(false);
    expect(isValidBrazilianPhone("00999999999")).toBe(false);
    expect(isValidBrazilianPhone("")).toBe(false);
    expect(isValidBrazilianPhone(null)).toBe(false);
  });
});

describe("upsertLeadPorTelefone - Fluxo RPC e Fallback", () => {
  it("chama a RPC atômica quando disponível e retorna o lead_id", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        action: "created",
        lead_id: "lead-123-uuid",
        telefone_normalizado: "66999126120",
      },
      error: null,
    });

    const mockAdmin = {
      rpc: mockRpc,
    } as any;

    const result = await upsertLeadPorTelefone(mockAdmin, {
      whatsapp: "(66) 99912-6120",
      nome: "Cliente Teste",
      origem: "simulador_consorcio",
      valor_simulado: 150000,
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe("created");
    expect(result.lead_id).toBe("lead-123-uuid");
    expect(result.telefone_normalizado).toBe("66999126120");
    expect(mockRpc).toHaveBeenCalledWith("rpc_upsert_lead_por_telefone", expect.any(Object));
  });

  it("utiliza fallback defensivo quando a RPC não está disponível no banco", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function rpc_upsert_lead_por_telefone does not exist", code: "42883" },
    });

    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "existing-lead-456",
                nome: "Cliente Existente",
                whatsapp: "66999126120",
                telefone_normalizado: "66999126120",
                email: null,
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockAdmin = {
      rpc: mockRpc,
      from: vi.fn((table: string) => {
        if (table === "leads") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return {};
      }),
    } as any;

    const result = await upsertLeadPorTelefone(mockAdmin, {
      whatsapp: "+55 (66) 99912-6120",
      email: "novo@email.com",
      valor_simulado: 200000,
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe("updated");
    expect(result.lead_id).toBe("existing-lead-456");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "novo@email.com",
        valor_simulado: 200000,
        telefone_normalizado: "66999126120",
      })
    );
  });

  it("acumula histórico com data na frente ao atualizar lead existente", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function rpc_upsert_lead_por_telefone does not exist", code: "42883" },
    });

    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "existing-lead-789",
                nome: "Cliente Recorrente",
                whatsapp: "66999126120",
                telefone_normalizado: "66999126120",
                historico_cadastros: "[10/08/2026 10:00] Nova abordagem / cadastro (Simulador Site):\n• Valor disponível / pretendido: R$ 150.000,00",
                observacoes: "Lead antigo interessado em imóvel",
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockAdmin = {
      rpc: mockRpc,
      from: vi.fn((table: string) => {
        if (table === "leads") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return {};
      }),
    } as any;

    const result = await upsertLeadPorTelefone(mockAdmin, {
      whatsapp: "(66) 99912-6120",
      evento_nome: "Feirão Agro 2026",
      origem: "evento",
      produto_interesse: "Pesados",
      valor_estimado: 400000,
      entrada: 50000,
      cidade: "Sinop - MT",
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe("updated");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        historico_cadastros: expect.stringContaining("Feirão Agro 2026"),
        observacoes: expect.stringContaining("Feirão Agro 2026"),
      })
    );

    // Confirma que o histórico antigo foi preservado e está separado por ---
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.historico_cadastros).toContain("---");
    expect(updateCall.historico_cadastros).toContain("Simulador Site");
    expect(updateCall.historico_cadastros).toContain("R$ 150.000,00");
    expect(updateCall.historico_cadastros).toContain("Pesados");
  });

  it("cria uma cópia / nova negociação quando o lead existente está no funil de ganho (Fechado / Ganho)", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function rpc_upsert_lead_por_telefone does not exist", code: "42883" },
    });

    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "lead-won-999",
                nome: "Cliente Comprador",
                whatsapp: "66999126120",
                telefone_normalizado: "66999126120",
                status: "Fechado",
                etapa_id: "etapa-won-id",
                srd_responsavel_id: "srd-1",
                srd_responsavel_nome: "Consultor Top",
                historico_cadastros: "[01/01/2026 10:00] Venda concluída: Imóvel R$ 300.000,00",
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "new-deal-lead-888" },
          error: null,
        }),
      }),
    });

    const mockAdmin = {
      rpc: mockRpc,
      from: vi.fn((table: string) => {
        if (table === "leads") {
          return {
            select: mockSelect,
            insert: mockInsert,
          };
        }
        return {};
      }),
    } as any;

    const result = await upsertLeadPorTelefone(mockAdmin, {
      whatsapp: "(66) 99912-6120",
      evento_nome: "Exposinop 2026",
      origem: "evento",
      produto_interesse: "Automóvel",
      valor_estimado: 120000,
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe("copied_new_deal");
    expect(result.lead_id).toBe("new-deal-lead-888");
    expect(result.lead_origem_ganho_id).toBe("lead-won-999");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "Novo",
        nome: "Cliente Comprador",
        srd_responsavel_id: "srd-1",
        srd_responsavel_nome: "Consultor Top",
        historico_cadastros: expect.stringContaining("NOVA NEGOCIAÇÃO"),
      })
    );

    const insertedData = mockInsert.mock.calls[0][0];
    expect(insertedData.historico_cadastros).toContain("Exposinop 2026");
    expect(insertedData.historico_cadastros).toContain("Venda concluída: Imóvel R$ 300.000,00");
  });

  it("permite gerar nova negociação forçada quando permitir_gerar_novo for true", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function rpc_upsert_lead_por_telefone does not exist", code: "42883" },
    });

    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "lead-won-777",
                nome: "Cliente Fiel",
                whatsapp: "66999126120",
                telefone_normalizado: "66999126120",
                status: "Fechado",
                historico_cadastros: "[01/01/2026] Venda 1",
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "new-forced-deal-id" },
          error: null,
        }),
      }),
    });

    const mockAdmin = {
      rpc: mockRpc,
      from: vi.fn((table: string) => {
        if (table === "leads") {
          return {
            select: mockSelect,
            insert: mockInsert,
          };
        }
        return {};
      }),
    } as any;

    const result = await upsertLeadPorTelefone(mockAdmin, {
      whatsapp: "(66) 99912-6120",
      permitir_gerar_novo: true,
      produto_interesse: "Investimento",
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe("copied_new_deal");
    expect(result.lead_id).toBe("new-forced-deal-id");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("reingressando lead ativo (não ganho) reposiciona na etapa Novo lead, redefine fechado/perdido e preserva a última observação", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function rpc_upsert_lead_por_telefone does not exist", code: "42883" },
    });

    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "lead-em-andamento-123",
                nome: "Carlos Silva",
                whatsapp: "66999126120",
                telefone_normalizado: "66999126120",
                status: "Perdido",
                etapa_id: "etapa-perdido-id",
                empresa_id: "empresa-1",
                historico_cadastros: "[01/05/2026 10:00] Cadastro inicial",
                observacoes: "Observação antiga que deve ser substituída pela nova",
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockAdmin = {
      rpc: mockRpc,
      from: vi.fn((table: string) => {
        if (table === "leads") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        if (table === "crm_funil_etapas") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "etapa-novo-lead-id" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as any;

    const result = await upsertLeadPorTelefone(mockAdmin, {
      whatsapp: "(66) 99912-6120",
      empresa_id: "empresa-1",
      produto_interesse: "Imóvel",
      observacoes: "Cliente voltou a ter interesse agora em setembro",
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe("updated");
    expect(result.lead_id).toBe("lead-em-andamento-123");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "Novo",
        etapa_id: "etapa-novo-lead-id",
        fechado: false,
        perdido_at: null,
        observacoes: "Cliente voltou a ter interesse agora em setembro",
        historico_cadastros: expect.stringContaining("Cliente voltou a ter interesse agora em setembro"),
      })
    );
    const updatePayload = mockUpdate.mock.calls[0][0];
    expect(updatePayload.historico_cadastros).toContain("Cadastro inicial");
  });
});



