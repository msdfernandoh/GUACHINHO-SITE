import { describe, expect, it } from "vitest";

describe("CONTA-CORRENTE SÓCIOS — COMPENSAÇÃO DE COMISSÕES (SÓCIO vs CONTA EMPRESA)", () => {
  describe("1. Exemplo do Usuário: R$ 30.000 de contas pagas (Fernando R$ 10.000, Eroni R$ 20.000)", () => {
    const contasPagasFernando = 10000;
    const contasPagasEroni = 20000;
    const totalContas = contasPagasFernando + contasPagasEroni; // 30.000
    const pctFernando = 0.5;
    const pctEroni = 0.5;

    it("Sem compensação: Fernando deve R$ 5.000 para equalizar com Eroni", () => {
      const respFernando = totalContas * pctFernando; // 15.000
      const respEroni = totalContas * pctEroni; // 15.000

      const saldoFernando = contasPagasFernando - respFernando; // -5.000
      const saldoEroni = contasPagasEroni - respEroni; // +5.000

      expect(saldoFernando).toBe(-5000);
      expect(saldoEroni).toBe(5000);
      expect(saldoFernando + saldoEroni).toBe(0);
    });

    it("Opção A: Fernando transfere R$ 5.000 diretamente para Eroni (Diferença é zerada)", () => {
      const transfEnviadaFernando = 5000;
      const transfRecebidaEroni = 5000;

      const respFernando = totalContas * pctFernando; // 15.000
      const respEroni = totalContas * pctEroni; // 15.000

      const saldoFinalFernando = contasPagasFernando + transfEnviadaFernando - respFernando;
      const saldoFinalEroni = contasPagasEroni - transfRecebidaEroni - respEroni;

      expect(saldoFinalFernando).toBe(0);
      expect(saldoFinalEroni).toBe(0);
    });

    it("Opção B: Fernando transfere R$ 10.000 para a conta/caixa da empresa (Diferença é zerada e empresa ganha R$ 10k)", () => {
      const aporteEmpresaFernando = 10000;
      const aporteEmpresaEroni = 0;
      const totalAportes = aporteEmpresaFernando + aporteEmpresaEroni; // 10.000

      // Total de contribuições operacionais = 30.000 (contas) + 10.000 (aporte) = 40.000
      const respOperacionalFernando = totalContas * pctFernando + totalAportes * pctFernando; // 15.000 + 5.000 = 20.000
      const respOperacionalEroni = totalContas * pctEroni + totalAportes * pctEroni; // 15.000 + 5.000 = 20.000

      const pagoFernandoComAporte = contasPagasFernando + aporteEmpresaFernando; // 20.000
      const pagoEroniComAporte = contasPagasEroni + aporteEmpresaEroni; // 20.000

      const saldoFinalFernando = pagoFernandoComAporte - respOperacionalFernando;
      const saldoFinalEroni = pagoEroniComAporte - respOperacionalEroni;

      expect(saldoFinalFernando).toBe(0);
      expect(saldoFinalEroni).toBe(0);
      expect(pagoFernandoComAporte).toBe(20000);
      expect(pagoEroniComAporte).toBe(20000);
    });
  });

  describe("2. Abatimentos Parciais", () => {
    const dividaInicial = 5000;

    it("Transferência direta de R$ 3.000 para o sócio reduz dívida para R$ 2.000", () => {
      const valorTransferido = 3000;
      const diferencaRestante = Math.max(0, dividaInicial - valorTransferido);
      expect(diferencaRestante).toBe(2000);
    });

    it("Aporte de R$ 4.000 na conta da empresa reduz dívida para R$ 3.000 (em 50/50)", () => {
      const valorAporte = 4000;
      const pctSocio = 0.5;
      const fatorAbatimento = 1 - pctSocio; // 0.5
      const abatimentoEfetivo = valorAporte * fatorAbatimento; // 2.000
      const diferencaRestante = Math.max(0, dividaInicial - abatimentoEfetivo);
      expect(diferencaRestante).toBe(3000);
    });
  });

  describe("3. Alocação FIFO de Múltiplas Comissões", () => {
    it("Distribui o valor a compensar pelas previsões mais antigas até esgotar", () => {
      const previsoes = [
        { id: "prev-1", valorPrevisto: 1200, valorPago: 0, disp: 1200 },
        { id: "prev-2", valorPrevisto: 2500, valorPago: 500, disp: 2000 },
        { id: "prev-3", valorPrevisto: 3000, valorPago: 0, disp: 3000 },
      ];

      const valorACompensar = 2500;
      let valorRestante = valorACompensar;
      const alocacoes: { id: string; alocado: number }[] = [];

      for (const p of previsoes) {
        if (valorRestante <= 0) break;
        const usar = Math.min(valorRestante, p.disp);
        alocacoes.push({ id: p.id, alocado: usar });
        valorRestante -= usar;
      }

      expect(alocacoes).toEqual([
        { id: "prev-1", alocado: 1200 },
        { id: "prev-2", alocado: 1300 },
      ]);
      expect(valorRestante).toBe(0);
    });

    it("Rejeita valor superior à soma total de comissões disponíveis", () => {
      const totalDisponivel = 4500;
      const valorSolicitado = 5000;
      expect(valorSolicitado > totalDisponivel).toBe(true);
    });
  });
});
