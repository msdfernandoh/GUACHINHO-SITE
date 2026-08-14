import { describe, expect, it } from "vitest";
import { parseContasPagarCsv } from "./contas-pagar-csv";

const header =
  "ID da Conta;Fornecedor / Favorecido;Valor (R$);Data de Lançamento;Data de Vencimento;Data de Pagamento;Status;Forma de Pagamento;Centro de Custo;Descrição;Banco de Pagamento;Pago Por (Responsável);Lançado Por;Nome Comprovante;Link do Comprovante;Observações;Necessita Revisão";

describe("importação CSV de contas", () => {
  it("normaliza a linha pendente deslocada do arquivo analisado", () => {
    const csv = `${header}\nabc;J Testa;R$ 883,50;02/08/2026;01/08/2026;Pendente;Em Atraso;PIX;Administrativo;Brita escritório;Gauchinho Particular;;Eroni;;;;Não`;
    const result = parseContasPagarCsv(csv);
    expect(result.erros).toEqual([]);
    expect(result.contas[0]).toMatchObject({
      importacaoChave: "abc",
      valor: 883.5,
      vencimento: "2026-08-01",
      dataPagamento: null,
      status: "aberta",
      formaPagamento: "PIX",
      centroCusto: "Administrativo",
    });
  });

  it("importa conta paga e campos com ponto e vírgula entre aspas", () => {
    const csv = `${header}\nxyz;Canetas;R$ 1.551,90;31/01/2026;30/01/2026;01/08/2026;Pago;PIX;Não informado;"Mercado; Livre";Gauchinho Particular;Eroni Bolfe;;;;;Não`;
    const result = parseContasPagarCsv(csv);
    expect(result.erros).toEqual([]);
    expect(result.contas[0]).toMatchObject({
      valor: 1551.9,
      status: "paga",
      dataPagamento: "2026-08-01",
      descricao: "Mercado; Livre",
      responsavelImportado: "Eroni Bolfe",
    });
  });

  it("preserva conta de valor zero somente quando exige revisão", () => {
    const csv = `${header}\nrev;A identificar;R$ 0,00;30/07/2026;29/07/2026;;Pendente;A_DEFINIR;A_DEFINIR;Não informado;;;;;;TESTE;Sim`;
    const result = parseContasPagarCsv(csv);
    expect(result.erros).toEqual([]);
    expect(result.contas[0]?.valor).toBe(0);
    expect(result.contas[0]?.necessitaRevisao).toBe(true);
  });

  it("ignora as linhas de exemplo do modelo", () => {
    const csv = `${header}\nEXEMPLO-PENDENTE-REMOVER;Fornecedor;100,00;14/08/2026;31/08/2026;;Pendente;PIX;Administrativo;Teste;;;;;;;Não`;
    expect(parseContasPagarCsv(csv).contas).toEqual([]);
  });
});
