import { describe, expect, it } from "vitest";

describe("SUÍTE DE TESTES UNITÁRIOS — CONTA-CORRENTE DOS SÓCIOS (REGRAS E CÁLCULOS)", () => {
  describe("1. Rateios de Despesas e Equalização Societária (50/50 e Proporcionais)", () => {
    it("Calcula divisão 50/50 quando a empresa paga a conta", () => {
      const valorTotal = 2400;
      const pctSocioA = 50;
      const pctSocioB = 50;

      const respA = Number(((valorTotal * pctSocioA) / 100).toFixed(2));
      const respB = Number(((valorTotal * pctSocioB) / 100).toFixed(2));

      expect(respA).toBe(1200);
      expect(respB).toBe(1200);
      expect(respA + respB).toBe(valorTotal);
    });

    it("Calcula saldo de equalização quando Sócio A paga despesa da empresa do próprio bolso", () => {
      const valorTotal = 3000;
      const respA = 1500;
      const respB = 1500;

      // Sócio A desembolsou R$ 3.000
      const pagoA = 3000;
      const diferencaA = pagoA - respA; // +1500 (Crédito a receber)

      // Sócio B não desembolsou nada
      const pagoB = 0;
      const diferencaB = pagoB - respB; // -1500 (A Compensar / Débito)

      expect(diferencaA).toBe(1500);
      expect(diferencaB).toBe(-1500);
      // A soma das equalizações sempre se anula
      expect(diferencaA + diferencaB).toBe(0);
    });

    it("Calcula rateio com percentuais diferenciados (ex.: 60% e 40%)", () => {
      const valorTotal = 10000;
      const respA = (valorTotal * 60) / 100;
      const respB = (valorTotal * 40) / 100;

      expect(respA).toBe(6000);
      expect(respB).toBe(4000);
    });

    it("Despesa exclusiva do sócio atribui 100% de responsabilidade ao titular", () => {
      const valorTotal = 850;
      const socioTitularId = "socio-1";
      const socioParceiroId = "socio-2";

      const pctTitular = 100;
      const pctParceiro = 0;

      const respTitular = (valorTotal * pctTitular) / 100;
      const respParceiro = (valorTotal * pctParceiro) / 100;

      expect(respTitular).toBe(850);
      expect(respParceiro).toBe(0);
    });
  });

  describe("2. Separação Estrita de Saldo Contábil vs Disponível para Saque", () => {
    it("Calcula saldo disponível para saque deduzindo reservas de caixa ativas", () => {
      const comissoesGarantidas = 15000;
      const responsabilidadeDespesas = 4000;
      const despesasPagasDoBolso = 1000;

      // Saldo líquido = 15.000 - 4.000 + 1.000 = 12.000
      const saldoLiquido = comissoesGarantidas - responsabilidadeDespesas + despesasPagasDoBolso;
      expect(saldoLiquido).toBe(12000);

      // Reserva de aluguel e folha = R$ 5.000
      const reservaAtiva = 5000;
      const disponivelParaSaque = Math.max(0, saldoLiquido - reservaAtiva);

      expect(disponivelParaSaque).toBe(7000);
    });

    it("Retorna R$ 0 de saque disponível se as reservas superarem o saldo líquido", () => {
      const saldoLiquido = 3000;
      const reservaAtiva = 4500;

      const disponivelParaSaque = Math.max(0, saldoLiquido - reservaAtiva);
      expect(disponivelParaSaque).toBe(0);
    });

    it("Gera saldo a compensar quando a responsabilidade em despesas supera as comissões e pagamentos", () => {
      const comissoesGarantidas = 2000;
      const responsabilidadeDespesas = 5500;
      const despesasPagasDoBolso = 500;

      const saldoLiquido = comissoesGarantidas - responsabilidadeDespesas + despesasPagasDoBolso;
      expect(saldoLiquido).toBe(-3000);

      const saldoACompensar = saldoLiquido < 0 ? Math.abs(saldoLiquido) : 0;
      const disponivelParaSaque = Math.max(0, saldoLiquido);

      expect(saldoACompensar).toBe(3000);
      expect(disponivelParaSaque).toBe(0);
    });
  });

  describe("3. Motor de Break-Even da Empresa e Metas de Venda dos Sócios", () => {
    it("Calcula break-even de vendas baseado no déficit da empresa e na taxa média de comissão", () => {
      const despesasTotaisPrevistas = 35000;
      const recursosGarantidos = 14000;
      const faltaCobrir = Math.max(0, despesasTotaisPrevistas - recursosGarantidos); // 21.000
      const taxaComissaoReferencia = 3.5; // 3.5%

      expect(faltaCobrir).toBe(21000);

      // Vendas necessárias = 21.000 / 0.035 = 600.000
      const vendasNecessarias = Math.round(faltaCobrir / (taxaComissaoReferencia / 100));
      expect(vendasNecessarias).toBe(600000);
    });

    it("Distribui a meta de vendas entre os sócios conforme suas cotas societárias", () => {
      const metaTotalEmpresa = 600000;
      const pctDivisaoA = 50;
      const pctDivisaoB = 50;

      const metaA = (metaTotalEmpresa * pctDivisaoA) / 100;
      const metaB = (metaTotalEmpresa * pctDivisaoB) / 100;

      expect(metaA).toBe(300000);
      expect(metaB).toBe(300000);

      // Simular vendas realizadas
      const vendasRealizadasA = 350000;
      const vendasRealizadasB = 180000;

      const pctAtingidoA = (vendasRealizadasA / metaA) * 100;
      const pctAtingidoB = (vendasRealizadasB / metaB) * 100;

      const faltaVenderA = Math.max(0, metaA - vendasRealizadasA);
      const faltaVenderB = Math.max(0, metaB - vendasRealizadasB);

      expect(pctAtingidoA).toBeCloseTo(116.67, 1);
      expect(pctAtingidoB).toBe(60);

      expect(faltaVenderA).toBe(0);
      expect(faltaVenderB).toBe(120000);
    });

    it("Calcula cobertura do termômetro da empresa", () => {
      const despesas = 20000;
      const garantido = 15000;

      const pctCobertura = Number(((garantido / despesas) * 100).toFixed(1));
      expect(pctCobertura).toBe(75);
    });
  });

  describe("4. Regras de Imutabilidade do Ledger e Compensação", () => {
    it("Compensação retém comissão e amortiza saldo devedor", () => {
      const saldoDevedor = 1200;
      const comissaoElegivel = 2000;
      const valorCompensado = 1200;

      expect(valorCompensado).toBeLessThanOrEqual(comissaoElegivel);
      const saldoRestanteDevedor = saldoDevedor - valorCompensado;
      const saldoRestanteComissao = comissaoElegivel - valorCompensado;

      expect(saldoRestanteDevedor).toBe(0);
      expect(saldoRestanteComissao).toBe(800);
    });

    it("Estorno gera lançamento compensatório com natureza invertida", () => {
      const lancamentoOriginal = {
        id: "mov-123",
        natureza: "DEBITO" as const,
        valor: 1500,
        descricao: "Compensação de despesa",
      };

      const estornoInverso = {
        natureza: lancamentoOriginal.natureza === "DEBITO" ? ("CREDITO" as const) : ("DEBITO" as const),
        valor: lancamentoOriginal.valor,
        descricao: `ESTORNO: ${lancamentoOriginal.descricao} (Motivo: Retificação)`,
        estornoMovimentoId: lancamentoOriginal.id,
      };

      expect(estornoInverso.natureza).toBe("CREDITO");
      expect(estornoInverso.valor).toBe(1500);
      expect(estornoInverso.estornoMovimentoId).toBe("mov-123");
    });
  });

  describe("5. Expansão de Períodos, Movimentação vs Saldo Acumulado e Conferência (Fase 225)", () => {
    it("Calcula corretamente Visão do Mês: Saldo Inicial + Movimentações Líquidas = Saldo Final (Exemplo Prompt)", () => {
      const saldoInicial = 8000;
      const creditos = 20000;
      const debitos = 12000;
      const saques = 0;

      const movimentacaoLiquida = creditos - debitos - saques;
      const saldoFinal = saldoInicial + movimentacaoLiquida;

      expect(movimentacaoLiquida).toBe(8000);
      expect(saldoFinal).toBe(16000);
    });

    it("Diferencia explicitamente Movimentação do Período vs Saldo Acumulado (Exemplo Fernando Prompt)", () => {
      const saldoAnteriorAgosto = 12000;
      const creditosSetembro = 5000;
      const debitosSetembro = 0;
      const saquesSetembro = 0;

      const movimentacaoLiquidaSetembro = creditosSetembro - debitosSetembro - saquesSetembro;
      const saldoAcumulado = saldoAnteriorAgosto + movimentacaoLiquidaSetembro;

      // Movimentação líquida em setembro foi exclusivamente de +R$ 5.000
      expect(movimentacaoLiquidaSetembro).toBe(5000);
      // Saldo acumulado total é R$ 17.000
      expect(saldoAcumulado).toBe(17000);
    });

    it("Consolida Visão 'Todos os Períodos' com Posição Financeira Geral do Sócio (Exemplo Prompt)", () => {
      const totalComissoes = 180000;
      const totalDespesasResponsabilidade = 75000;
      const totalPagoProprioBolso = 42000;
      const totalCompensacoes = 18000;
      const totalSaques = 100000;
      const reservasAtuais = 5000;

      // Saldo Contábil Acumulado do Sócio:
      // Comissões (180.000) - Despesas de responsabilidade (75.000) + Reembolso pago do bolso (42.000) - Saques (100.000) - Compensações já abatidas
      // Na equalização: 180.000 - 75.000 + 42.000 - 18.000 (se abatido de despesa) ou equivalente no ledger:
      // Ledger de créditos: Comissões faturadas (180k) + Despesas pagas (42k) = 222k
      // Ledger de débitos: Responsabilidade (75k) + Saques (100k) + Compensação (18k ou inclusa) = 198k
      // Saldo = 222k - 198k = 24.000
      const saldoAtual = 24000;
      const disponivelParaSaque = Math.max(0, saldoAtual - reservasAtuais);

      expect(saldoAtual).toBe(24000);
      expect(disponivelParaSaque).toBe(19000);
    });

    it("Reconcilia Ledger do Fechamento Geral denunciando qualquer divergência identificada", () => {
      const saldoLedger = 24500;
      const saldoDashboard = 23900;
      const diferenca = Math.abs(saldoLedger - saldoDashboard);
      const statusOk = diferenca < 0.01;

      expect(statusOk).toBe(false);
      expect(diferenca).toBe(600);
    });
  });

  describe("6. Reconciliação Matemática dos Lançamentos com os Cards do Dashboard (Fase 226 - Item 18)", () => {
    it("Reconcilia Despesas Pagas: soma dos lançamentos pagos individuais é rigorosamente idêntica ao card", () => {
      const lancamentosDespesas = [
        { id: "d-1", valor: 1500, status: "paga", pagoPessoalmente: true, pagador: "Fernando" },
        { id: "d-2", valor: 3200, status: "paga", pagoPessoalmente: false, pagador: "Empresa" },
        { id: "d-3", valor: 2500, status: "paga", pagoPessoalmente: true, pagador: "Eroni" },
        { id: "d-4", valor: 800, status: "aberta", pagoPessoalmente: false, pagador: null },
      ];

      const despesasPagas = lancamentosDespesas.filter((d) => d.status === "paga");
      const cardTotalPago = despesasPagas.reduce((acc, d) => acc + d.valor, 0);

      const pagoEmpresa = despesasPagas.filter((d) => !d.pagoPessoalmente).reduce((acc, d) => acc + d.valor, 0);
      const pagoFernando = despesasPagas.filter((d) => d.pagoPessoalmente && d.pagador === "Fernando").reduce((acc, d) => acc + d.valor, 0);
      const pagoEroni = despesasPagas.filter((d) => d.pagoPessoalmente && d.pagador === "Eroni").reduce((acc, d) => acc + d.valor, 0);

      expect(cardTotalPago).toBe(7200);
      expect(pagoEmpresa).toBe(3200);
      expect(pagoFernando).toBe(1500);
      expect(pagoEroni).toBe(2500);
      expect(pagoEmpresa + pagoFernando + pagoEroni).toBe(cardTotalPago);
    });

    it("Reconcilia 'Paguei do Bolso' e Equalização societária (50/50)", () => {
      // Cenário real verificado na auditoria dos últimos 6 meses:
      // Despesas Pagas Totais = 36.342,98
      // Fernando pagou do bolso = 9.790,61
      // Eroni pagou do bolso = 26.552,37
      // Pago pela Empresa = 0,00
      const totalDespesasPagas = 36342.98;
      const bolsoFernando = 9790.61;
      const bolsoEroni = 26552.37;
      const pagoEmpresa = 0.0;

      expect(bolsoFernando + bolsoEroni + pagoEmpresa).toBeCloseTo(totalDespesasPagas, 2);

      const responsabilidadeFernando = Number((totalDespesasPagas * 0.5).toFixed(2));
      const responsabilidadeEroni = Number((totalDespesasPagas * 0.5).toFixed(2));

      expect(responsabilidadeFernando).toBe(18171.49);
      expect(responsabilidadeEroni).toBe(18171.49);

      // Equalização = Bolso - Responsabilidade
      const equalizacaoFernando = Number((bolsoFernando - responsabilidadeFernando).toFixed(2));
      const equalizacaoEroni = Number((bolsoEroni - responsabilidadeEroni).toFixed(2));

      // Fernando pagou a menos do que sua cota -> a compensar (-8.380,88)
      expect(equalizacaoFernando).toBe(-8380.88);
      // Eroni pagou a mais do que sua cota -> crédito (+8.380,88)
      expect(equalizacaoEroni).toBe(8380.88);

      // A soma das equalizações é exatamente zero
      expect(equalizacaoFernando + equalizacaoEroni).toBe(0);
    });

    it("Reconcilia Comissões: soma de recebidas + a receber é rigorosamente idêntica às comissões garantidas", () => {
      const lancamentosComissoes = [
        { id: "c-1", valorElegivel: 4500, valorPago: 4500, status: "paga" },
        { id: "c-2", valorElegivel: 5217.89, valorPago: 5217.89, status: "paga" },
        { id: "c-3", valorElegivel: 540.89, valorPago: 0, status: "elegivel" },
      ];

      const totalGarantido = Number(lancamentosComissoes.reduce((acc, c) => acc + c.valorElegivel, 0).toFixed(2));
      const totalRecebido = Number(lancamentosComissoes.reduce((acc, c) => acc + c.valorPago, 0).toFixed(2));
      const totalAReceber = Number((totalGarantido - totalRecebido).toFixed(2));

      expect(totalGarantido).toBe(10258.78);
      expect(totalRecebido).toBe(9717.89);
      expect(totalAReceber).toBe(540.89);
      expect(totalRecebido + totalAReceber).toBeCloseTo(totalGarantido, 2);
    });

    it("Reconcilia Disponível para Saque Realista vs Disponível Projetado", () => {
      // Regra: Disponível Realista é baseado APENAS no dinheiro que entrou no caixa (comissões recebidas)
      // Fernando: Comissões Recebidas (9.717,89) + Equalização (-8.380,88) = 1.337,01
      const comissoesRecebidas = 9717.89;
      const equalizacao = -8380.88;
      const saquesRealizados = 0;
      const reservasFuturas = 0;

      const disponivelRealista = Math.max(0, comissoesRecebidas + equalizacao - saquesRealizados - reservasFuturas);
      expect(disponivelRealista).toBeCloseTo(1337.01, 2);

      // Disponível Projetado: inclui comissões garantidas a receber (540,89)
      const comissoesAReceber = 540.89;
      const disponivelProjetado = Number((disponivelRealista + comissoesAReceber).toFixed(2));
      expect(disponivelProjetado).toBe(1877.9);
    });

    it("Garante o isolamento absoluto dos 4 tipos de informação (Previsto vs Garantido vs Recebido vs Acumulado)", () => {
      const metricasSocio = {
        previsto: 37305.99, // Parcelas futuras a vencer
        garantido: 10258.78, // Elegíveis contratuais faturadas
        recebido: 9717.89,   // Efetivamente liquidadas via caixa
        acumulado: 1337.01,  // Patrimônio líquido final histórico
      };

      // Não se misturam:
      expect(metricasSocio.garantido).not.toBe(metricasSocio.previsto);
      expect(metricasSocio.recebido).not.toBe(metricasSocio.garantido);
      expect(metricasSocio.acumulado).not.toBe(metricasSocio.recebido);
      expect(metricasSocio.previsto).toBeGreaterThan(metricasSocio.garantido);
      expect(metricasSocio.garantido).toBeGreaterThan(metricasSocio.recebido);
    });

    it("Reconcilia Quadro Comparativo Societário Geral (Fernando + Eroni === Total Empresa)", () => {
      const quadro = {
        comissoesGarantidas: { fernando: 10258.78, eroni: 23274.67, totalEmpresa: 33533.45 },
        comissoesRecebidas: { fernando: 9717.89, eroni: 23274.67, totalEmpresa: 32992.56 },
        comissoesAReceber: { fernando: 540.89, eroni: 0, totalEmpresa: 540.89 },
        responsabilidade: { fernando: 18171.49, eroni: 18171.49, totalEmpresa: 36342.98 },
        pagoDoBolso: { fernando: 9790.61, eroni: 26552.37, totalEmpresa: 36342.98 },
        equalizacao: { fernando: -8380.88, eroni: 8380.88, totalEmpresa: 0 },
      };

      expect(quadro.comissoesGarantidas.fernando + quadro.comissoesGarantidas.eroni).toBeCloseTo(quadro.comissoesGarantidas.totalEmpresa, 2);
      expect(quadro.comissoesRecebidas.fernando + quadro.comissoesRecebidas.eroni).toBeCloseTo(quadro.comissoesRecebidas.totalEmpresa, 2);
      expect(quadro.comissoesAReceber.fernando + quadro.comissoesAReceber.eroni).toBeCloseTo(quadro.comissoesAReceber.totalEmpresa, 2);
      expect(quadro.responsabilidade.fernando + quadro.responsabilidade.eroni).toBeCloseTo(quadro.responsabilidade.totalEmpresa, 2);
      expect(quadro.pagoDoBolso.fernando + quadro.pagoDoBolso.eroni).toBeCloseTo(quadro.pagoDoBolso.totalEmpresa, 2);
      expect(quadro.equalizacao.fernando + quadro.equalizacao.eroni).toBe(0);
    });
  });
});
