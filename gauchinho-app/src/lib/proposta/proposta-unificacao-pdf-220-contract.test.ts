import { describe, it, expect, vi } from "vitest";
import {
  getInicioDoDiaBrasilUtc,
  getDataBrasilString,
  extrairIdentificadorCliente,
  agruparPropostasPorClienteEData,
  STATUS_UNIFICAVEIS,
} from "./proposta-unificacao-service";

describe("Fase 220 — Contrato de Unificação de Propostas e PDF", () => {
  describe("proposta-unificacao-service", () => {
    it("deve calcular o início do dia no fuso horário de Brasília (UTC-3)", () => {
      const refDate = new Date("2026-09-10T15:30:00Z");
      const inicio = getInicioDoDiaBrasilUtc(refDate);
      // No fuso de Brasília (UTC-3), 2026-09-10T00:00:00-03:00 corresponde a 2026-09-10T03:00:00.000Z
      expect(inicio).toBe("2026-09-10T03:00:00.000Z");
    });

    it("deve formatar data no formato YYYY-MM-DD no fuso de Brasília", () => {
      // 01:00 UTC do dia 11 ainda é dia 10 às 22:00 no fuso de Brasília
      const dataBr = getDataBrasilString("2026-09-11T01:00:00Z");
      expect(dataBr).toBe("2026-09-10");
    });

    it("deve extrair identificador do cliente priorizando telefone sanitizado", () => {
      const p1 = {
        whatsapp_cliente: "(51) 99999-8888",
        nome_cliente: "João da Silva",
      };
      expect(extrairIdentificadorCliente(p1)).toBe("51999998888");

      const p2 = {
        whatsapp_cliente: "123", // Inválido (< 10 dígitos)
        nome_cliente: "  Maria  Oliveira  ",
      };
      expect(extrairIdentificadorCliente(p2)).toBe("maria oliveira");

      const p3 = {
        whatsapp_cliente: null,
        nome_cliente: null,
      };
      expect(extrairIdentificadorCliente(p3)).toBe("cliente-desconhecido");
    });

    it("deve agrupar propostas do mesmo cliente geradas na mesma data", () => {
      const propostas = [
        {
          id: "prop-1",
          created_at: "2026-09-10T14:00:00-03:00",
          nome_cliente: "João Silva",
          whatsapp_cliente: "51999998888",
          valor_credito: 100000,
        },
        {
          id: "prop-2", // Mais recente do João no dia 10
          created_at: "2026-09-10T16:00:00-03:00",
          nome_cliente: "João Silva",
          whatsapp_cliente: "51999998888",
          valor_credito: 150000,
        },
        {
          id: "prop-3", // João em outro dia
          created_at: "2026-09-09T10:00:00-03:00",
          nome_cliente: "João Silva",
          whatsapp_cliente: "51999998888",
          valor_credito: 80000,
        },
        {
          id: "prop-4", // Outro cliente no dia 10
          created_at: "2026-09-10T15:00:00-03:00",
          nome_cliente: "Carlos Souza",
          whatsapp_cliente: "51988887777",
          valor_credito: 200000,
        },
      ];

      const grupos = agruparPropostasPorClienteEData(propostas);

      // Deve ter 3 grupos: João dia 10, Carlos dia 10, João dia 09
      expect(grupos).toHaveLength(3);

      const grupoJoaoDia10 = grupos.find(
        (g) => g.clienteIdentificador === "51999998888" && g.dataReferencia === "2026-09-10",
      );
      expect(grupoJoaoDia10).toBeDefined();
      expect(grupoJoaoDia10?.totalNoDia).toBe(2);
      expect(grupoJoaoDia10?.propostaPrincipal.id).toBe("prop-2"); // a mais recente
      expect(grupoJoaoDia10?.propostasDoDia).toHaveLength(2);
      expect(grupoJoaoDia10?.propostasDoDia[1].id).toBe("prop-1");

      const grupoCarlos = grupos.find((g) => g.clienteIdentificador === "51988887777");
      expect(grupoCarlos?.totalNoDia).toBe(1);
      expect(grupoCarlos?.propostaPrincipal.id).toBe("prop-4");

      const grupoJoaoDia9 = grupos.find(
        (g) => g.clienteIdentificador === "51999998888" && g.dataReferencia === "2026-09-09",
      );
      expect(grupoJoaoDia9?.totalNoDia).toBe(1);
      expect(grupoJoaoDia9?.propostaPrincipal.id).toBe("prop-3");
    });

    it("deve definir corretamente os status unificáveis sem incluir status final", () => {
      expect(STATUS_UNIFICAVEIS).toContain("Gerada");
      expect(STATUS_UNIFICAVEIS).toContain("PDF gerado");
      expect(STATUS_UNIFICAVEIS).toContain("Em negociação");
      expect(STATUS_UNIFICAVEIS).toContain("Enviada");
      expect(STATUS_UNIFICAVEIS).toContain("Aprovada");

      // Status finais NUNCA devem ser unificados
      expect(STATUS_UNIFICAVEIS).not.toContain("Contratada");
      expect(STATUS_UNIFICAVEIS).not.toContain("Cancelada");
      expect(STATUS_UNIFICAVEIS).not.toContain("Perdida");
    });
  });

  describe("Contrato da rota pública de PDF /api/public/contratacoes/[token]/pdf", () => {
    it("deve validar tokens com o padrão canônico do sistema", async () => {
      const { generatePublicToken, isValidPublicToken } = await import(
        "@/lib/contratacoes-online/public-token"
      );
      const token = generatePublicToken();
      expect(isValidPublicToken(token)).toBe(true);
      expect(isValidPublicToken("abc")).toBe(false); // Curto demais (< 16)
      expect(isValidPublicToken("")).toBe(false);
    });
  });
});
