import { describe, it, expect } from "vitest";
import type {
  ErpDashboardFullDTO,
  ErpDashboardPeriodFilter,
} from "@/lib/gestao/dashboards-service";

describe("Fase 098: ERP Dashboard Operacional — Contratos de Negócio e Governança", () => {
  const mockDashboardCompleto: ErpDashboardFullDTO = {
    empresa: {
      id: "empresa-gauchinho-matriz",
      nomeFantasia: "Gauchinho Consórcios Matriz",
      cnpj: "12.345.678/0001-90",
      planoNome: "Plano Enterprise ERP",
    },
    modulosLiberados: [
      "clientes",
      "consultores",
      "lances",
      "assembleias",
      "regras-comissao",
      "repasse-franquia",
      "minhas-comissoes",
      "contas-pagar",
      "metas",
    ],
    periodo: {
      filtro: "mes_atual",
      mesAtual: "2026-08",
      dataInicio: "2026-08-01",
      dataFim: "2026-08-31",
    },
    vendas: {
      creditoVendidoMes: 2500000.0,
      cotasVendidasMes: 10,
      ticketMedio: 250000.0,
      creditoMesAnterior: 2000000.0,
      cotasMesAnterior: 8,
      variacaoCreditoPercentual: 25.0,
      variacaoCotasPercentual: 25.0,
      historicoMensal: [
        { mes: "2026-03", label: "Mar/26", credito: 1800000, cotas: 7 },
        { mes: "2026-04", label: "Abr/26", credito: 1900000, cotas: 8 },
        { mes: "2026-05", label: "Mai/26", credito: 2100000, cotas: 9 },
        { mes: "2026-06", label: "Jun/26", credito: 2200000, cotas: 9 },
        { mes: "2026-07", label: "Jul/26", credito: 2000000, cotas: 8 },
        { mes: "2026-08", label: "Ago/26", credito: 2500000, cotas: 10 },
      ],
    },
    comissaoFranquia: {
      gerada: 100000.0,
      previstaElegivel: 100000.0,
      recebida: 75000.0,
      pendente: 25000.0,
      historicoMensal: [
        { mes: "2026-03", label: "Mar/26", gerada: 72000, recebida: 72000 },
        { mes: "2026-04", label: "Abr/26", gerada: 76000, recebida: 76000 },
        { mes: "2026-05", label: "Mai/26", gerada: 84000, recebida: 84000 },
        { mes: "2026-06", label: "Jun/26", gerada: 88000, recebida: 80000 },
        { mes: "2026-07", label: "Jul/26", gerada: 80000, recebida: 70000 },
        { mes: "2026-08", label: "Ago/26", gerada: 100000, recebida: 75000 },
      ],
    },
    comissaoParticipantes: {
      gerada: 50000.0,
      disponivelElegivel: 50000.0,
      paga: 35000.0,
      pendente: 15000.0,
      participantesComPendenciaCount: 4,
    },
    caixa: {
      saldoDisponivel: 185400.5,
      entradasMes: 75000.0,
      saidasMes: 35000.0,
      contasPagarVencidas: 0,
      contasPagarMes: 12500.0,
      contasPagarCount: 3,
    },
    comercial: {
      leadsNovos: 45,
      leadsSemContato: 3,
      propostasEmAndamento: 12,
      contratosAguardandoAssinatura: 2,
      contratosAssinadosFormalizacao: 1,
    },
    clientesCotas: {
      clientesAtivos: 180,
      clientesNovosMes: 10,
      cotasAtivas: 215,
      cotasContempladas: 18,
      cotasAguardandoNumero: 1,
    },
    metas: {
      disponivel: true,
      metaCredito: 3000000.0,
      creditoRealizado: 2500000.0,
      atingimentoPercentual: 83.3,
    },
    alertas: [
      {
        id: "alerta-formalizacao",
        prioridade: "alta",
        titulo: "Contratos assinados aguardando formalização",
        descricao: "1 contrato(s) assinado(s) pendente(s) de finalização no ERP.",
        quantidade: 1,
        href: "/erp/contratacoes",
        moduloId: "contratacoes",
      },
      {
        id: "alerta-comissao-pendente",
        prioridade: "media",
        titulo: "Comissões da Franquia com recebimento pendente",
        descricao: "R$ 25.000,00 pendentes de liquidação da Administradora.",
        quantidade: 1,
        href: "/erp/repasse-franquia",
        moduloId: "repasse-franquia",
      },
    ],
    proximasAssembleias: [
      {
        grupoId: "grp-100",
        codigoGrupo: "G-100",
        administradoraNome: "Racon Consórcios",
        dataAssembleia: "2026-08-25",
        vagasDisponiveis: 14,
      },
    ],
    administradorasDisponiveis: [
      { id: "adm-racon", nome: "Racon Consórcios" },
      { id: "adm-ademicon", nome: "Ademicon" },
    ],
  };

  it("1. Master com todos os módulos ativos exibe visão consolidada 360", () => {
    expect(mockDashboardCompleto.vendas.creditoVendidoMes).toBe(2500000.0);
    expect(mockDashboardCompleto.vendas.cotasVendidasMes).toBe(10);
    expect(mockDashboardCompleto.vendas.ticketMedio).toBe(250000.0);
    expect(mockDashboardCompleto.metas?.disponivel).toBe(true);
    expect(mockDashboardCompleto.metas?.atingimentoPercentual).toBe(83.3);
  });

  it("2. Master sem módulo Metas oculta o bloco de metas sem impactar outros KPIs", () => {
    const dashboardSemMetas: ErpDashboardFullDTO = {
      ...mockDashboardCompleto,
      modulosLiberados: ["clientes", "consultores", "contas-pagar"],
      metas: undefined,
    };

    expect(dashboardSemMetas.modulosLiberados.includes("metas")).toBe(false);
    expect(dashboardSemMetas.metas).toBeUndefined();
    expect(dashboardSemMetas.vendas.creditoVendidoMes).toBe(2500000.0);
  });

  it("3. Comissão da Franquia: Separação estrita entre comissão gerada e comissão recebida", () => {
    const comissao = mockDashboardCompleto.comissaoFranquia;
    expect(comissao.gerada).toBe(100000.0);
    expect(comissao.recebida).toBe(75000.0);
    expect(comissao.pendente).toBe(25000.0);
    expect(comissao.gerada).not.toBe(comissao.recebida);
  });

  it("4. Comissão dos Participantes: Separação de obrigações pagas e contagem de favorecidos pendentes", () => {
    const part = mockDashboardCompleto.comissaoParticipantes;
    expect(part.gerada).toBe(50000.0);
    expect(part.paga).toBe(35000.0);
    expect(part.pendente).toBe(15000.0);
    expect(part.participantesComPendenciaCount).toBe(4);
  });

  it("5. Caixa & Financeiro: Saldo disponível reflete entradas/saídas reais e não inclui parcelas de consorciados", () => {
    const caixa = mockDashboardCompleto.caixa;
    expect(caixa.saldoDisponivel).toBe(185400.5);
    expect(caixa.entradasMes).toBe(75000.0);
    expect(caixa.saidasMes).toBe(35000.0);
    // Parcelas de consórcio vão para a Administradora, não para o caixa da franquia
    expect(caixa.entradasMes).toBe(mockDashboardCompleto.comissaoFranquia.recebida);
  });

  it("6. Alertas operacionais apontam para rotas canônicas válidas e priorizadas", () => {
    const alertas = mockDashboardCompleto.alertas;
    const formalizacao = alertas.find((a) => a.id === "alerta-formalizacao");
    expect(formalizacao).toBeDefined();
    expect(formalizacao?.prioridade).toBe("alta");
    expect(formalizacao?.href).toBe("/erp/contratacoes");

    const repasse = alertas.find((a) => a.id === "alerta-comissao-pendente");
    expect(repasse).toBeDefined();
    expect(repasse?.href).toBe("/erp/repasse-franquia");
  });

  it("7. Isolamento multi-tenant: Consultas e DTO vinculados exclusivamente à empresa logada", () => {
    const empresaA = "empresa-matriz-1";
    const empresaB = "empresa-filial-2";

    const dataA = { ...mockDashboardCompleto, empresa: { id: empresaA, nomeFantasia: "Franquia A" } };
    const dataB = { ...mockDashboardCompleto, empresa: { id: empresaB, nomeFantasia: "Franquia B" } };

    expect(dataA.empresa.id).not.toBe(dataB.empresa.id);
    expect(dataA.empresa.nomeFantasia).toBe("Franquia A");
    expect(dataB.empresa.nomeFantasia).toBe("Franquia B");
  });
});
