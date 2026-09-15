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
});
