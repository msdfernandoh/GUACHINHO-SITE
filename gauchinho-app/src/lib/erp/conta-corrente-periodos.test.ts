import { describe, expect, it } from "vitest";
import {
  resolverIntervaloPeriodo,
  encadearConferenciaMensal,
  reconciliarLedgerComDashboard,
  formatarRotuloMes,
  type LancamentoConferenciaDTO,
} from "./conta-corrente-periodos";

describe("SUÍTE DE TESTES UNITÁRIOS — EXPANSÃO DE PERÍODOS E CONFERÊNCIA CONTA-CORRENTE", () => {
  describe("1. Resolução de Intervalos e Filtros de Período", () => {
    const refHoje = "2026-09-15";

    it("Resolve mês específico explicitado", () => {
      const res = resolverIntervaloPeriodo({
        tipoPeriodo: "mes",
        competencia: "2026-09",
        referenciaHoje: refHoje,
      });

      expect(res.tipoPeriodo).toBe("mes");
      expect(res.competencia).toBe("2026-09");
      expect(res.dataInicio).toBe("2026-09-01");
      expect(res.dataFim).toBe("2026-09-30");
      expect(res.isMesUnico).toBe(true);
      expect(res.isTodosPeriodos).toBe(false);
      expect(res.rotuloPeriodo).toBe("Setembro/2026");
    });

    it("Resolve Mês Atual", () => {
      const res = resolverIntervaloPeriodo({
        tipoPeriodo: "mes_atual",
        referenciaHoje: refHoje,
      });

      expect(res.competencia).toBe("2026-09");
      expect(res.dataInicio).toBe("2026-09-01");
      expect(res.dataFim).toBe("2026-09-30");
      expect(res.isMesUnico).toBe(true);
      expect(res.rotuloPeriodo).toContain("Mês Atual");
    });

    it("Resolve Mês Anterior (Agosto/2026)", () => {
      const res = resolverIntervaloPeriodo({
        tipoPeriodo: "mes_anterior",
        referenciaHoje: refHoje,
      });

      expect(res.competencia).toBe("2026-08");
      expect(res.dataInicio).toBe("2026-08-01");
      expect(res.dataFim).toBe("2026-08-31");
      expect(res.isMesUnico).toBe(true);
      expect(res.rotuloPeriodo).toContain("Mês Anterior");
    });

    it("Resolve Últimos 3 Meses (Julho a Setembro/2026)", () => {
      const res = resolverIntervaloPeriodo({
        tipoPeriodo: "ultimos_3_meses",
        referenciaHoje: refHoje,
      });

      expect(res.dataInicio).toBe("2026-07-01");
      expect(res.dataFim).toBe("2026-09-30");
      expect(res.isMesUnico).toBe(false);
      expect(res.rotuloPeriodo).toBe("Últimos 3 Meses");
    });

    it("Resolve Últimos 6 Meses (Abril a Setembro/2026)", () => {
      const res = resolverIntervaloPeriodo({
        tipoPeriodo: "ultimos_6_meses",
        referenciaHoje: refHoje,
      });

      expect(res.dataInicio).toBe("2026-04-01");
      expect(res.dataFim).toBe("2026-09-30");
      expect(res.rotuloPeriodo).toBe("Últimos 6 Meses");
    });

    it("Resolve Ano Atual (2026 inteiro)", () => {
      const res = resolverIntervaloPeriodo({
        tipoPeriodo: "ano_atual",
        referenciaHoje: refHoje,
      });

      expect(res.dataInicio).toBe("2026-01-01");
      expect(res.dataFim).toBe("2026-12-31");
      expect(res.rotuloPeriodo).toBe("Ano 2026");
    });

    it("Resolve Todos os Períodos (acumulado histórico geral)", () => {
      const res = resolverIntervaloPeriodo({
        tipoPeriodo: "todos_periodos",
        referenciaHoje: refHoje,
      });

      expect(res.dataInicio).toBe("2000-01-01");
      expect(res.dataFim).toBe("2099-12-31");
      expect(res.isTodosPeriodos).toBe(true);
      expect(res.rotuloPeriodo).toBe("Todos os Períodos");
    });

    it("Resolve Período Personalizado com De/Até", () => {
      const res = resolverIntervaloPeriodo({
        tipoPeriodo: "personalizado",
        dataInicio: "2026-01-01",
        dataFim: "2026-09-30",
        referenciaHoje: refHoje,
      });

      expect(res.dataInicio).toBe("2026-01-01");
      expect(res.dataFim).toBe("2026-09-30");
      expect(res.rotuloPeriodo).toBe("01/01/2026 até 30/09/2026");
    });
  });

  describe("2. Quadro de Conferência Mensal Encadeado", () => {
    it("Garante que o saldo inicial de um mês é RIGOROSAMENTE igual ao saldo final do mês anterior", () => {
      const movimentosMap = new Map();

      movimentosMap.set("2026-08", {
        creditos: 20000,
        debitos: 8000,
        reservas: 0,
        saques: 5000,
        ajustes: 0,
        statusFechamento: "FECHADO" as const,
        fechamentoId: "fech-08",
        lancamentos: [] as LancamentoConferenciaDTO[],
      });

      movimentosMap.set("2026-09", {
        creditos: 15000,
        debitos: 4000,
        reservas: 2000,
        saques: 3000,
        ajustes: 0,
        statusFechamento: "ABERTO" as const,
        fechamentoId: null,
        lancamentos: [] as LancamentoConferenciaDTO[],
      });

      const quadro = encadearConferenciaMensal(["2026-08", "2026-09"], movimentosMap, 0);

      expect(quadro).toHaveLength(2);

      // AGO/2026
      const ago = quadro[0];
      expect(ago.competencia).toBe("2026-08");
      expect(ago.saldoInicial).toBe(0);
      expect(ago.creditos).toBe(20000);
      expect(ago.debitos).toBe(8000);
      expect(ago.saques).toBe(5000);
      // Saldo final = 0 + 20.000 - 8.000 - 5.000 = 7.000
      expect(ago.saldoFinal).toBe(7000);
      expect(ago.statusFechamento).toBe("FECHADO");

      // SET/2026
      const set = quadro[1];
      expect(set.competencia).toBe("2026-09");
      // Regra de ouro: Saldo Inicial de Setembro DEVE ser 7.000 (igual ao saldo final de Agosto)
      expect(set.saldoInicial).toBe(ago.saldoFinal);
      expect(set.saldoInicial).toBe(7000);
      expect(set.creditos).toBe(15000);
      expect(set.debitos).toBe(4000);
      expect(set.saques).toBe(3000);
      // Saldo final = 7.000 + 15.000 - 4.000 - 3.000 = 15.000
      expect(set.saldoFinal).toBe(15000);
      expect(set.statusFechamento).toBe("ABERTO");
    });
  });

  describe("3. Auditoria do Ledger e Detecção de Divergência", () => {
    it("Retorna status OK quando o ledger bate 100% com a apuração", () => {
      const res = reconciliarLedgerComDashboard({
        saldoLedger: 24500,
        saldoApurado: 24500,
        todosCreditos: 180000,
        todosDebitos: 75000,
        todosSaques: 80500,
        reservasVigentes: 5000,
      });

      expect(res.status).toBe("OK");
      expect(res.divergencia).toBe(0);
      expect(res.saldoCalculadoHistorico).toBe(24500);
      expect(res.saldoExibidoDashboard).toBe(24500);
    });

    it("Denuncia divergência com ALERTA DE DIVERGÊNCIA quando houver diferença", () => {
      const res = reconciliarLedgerComDashboard({
        saldoLedger: 24500,
        saldoApurado: 23900,
        todosCreditos: 180000,
        todosDebitos: 75000,
        todosSaques: 81100,
        reservasVigentes: 5000,
      });

      expect(res.status).toBe("DIVERGENCIA");
      expect(res.divergencia).toBe(600);
      expect(res.mensagemAuditoria).toContain("Divergência detectada de R$ 600,00");
    });
  });
});
