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
});
