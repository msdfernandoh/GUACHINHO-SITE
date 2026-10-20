import { describe, expect, it } from "vitest";
import { calcularComissaoRecebida, calcularTransferenciasSocio } from "./comissao-recebida-socio";
import { calcularFechamentoSocios } from "./fechamento-socios";

describe("crédito societário pelo recebimento", () => {
  it("reconhece recebimento parcial sem exigir pagamento ou conferência", () => {
    expect(calcularComissaoRecebida(850, 1000, 400)).toBe(340);
    expect(calcularComissaoRecebida(850, 1000, 0)).toBe(0);
  });
  it("compensa reversões de vínculo sem duplicar o crédito", () => {
    expect([1000, -1000, 500].reduce((s, v) => s + calcularComissaoRecebida(850, 1000, v), 0)).toBe(425);
  });
  it("reduz crédito somente pela transferência e pelo rateio e pode gerar débito", () => {
    const resultado = calcularFechamentoSocios({ despesasPagas: 400, lucroConsultores: 0,
      reservaImpostos: 0, caixaAntes: 500, socios: [
        { id: "a", nome: "A", percentual: 50, comissaoGuardada: 850, adiantamentoPessoal: 0, saldoAnterior: 0, retirada: 0, transferenciasRealizadas: 300 },
        { id: "b", nome: "B", percentual: 50, comissaoGuardada: 100, adiantamentoPessoal: 0, saldoAnterior: 0, retirada: 0 },
      ] });
    expect(resultado.socios[0].direitoAntesRetirada).toBe(350);
    expect(resultado.socios[1].faltaCobrir).toBe(100);
    expect(resultado.caixaDepois).toBe(500); // Transferência histórica já está no saldo bancário.
  });
});

it("distingue baixa contábil de transferência real e considera devolução/estorno", () => {
  const base = { inicio: "2026-10-01", fim: "2026-10-20", contasDoSocio: new Set(["pessoal"]), contasEmpresa: new Set(["pj"]), pagamentosDoSocio: new Set(["pag"]) };
  const movimento = { conta_bancaria_id: "pessoal", pagamento_id: "pag", transferencia_conta_id: null, tipo: "ENTRADA", valor: 500, data_movimento: "2026-10-10" };
  expect(calcularTransferenciasSocio({ ...base, movimentos: [movimento] })).toBe(0);
  const saida = { ...movimento, conta_bancaria_id: "pj", tipo: "SAIDA" };
  expect(calcularTransferenciasSocio({ ...base, movimentos: [movimento, saida] })).toBe(500);
  expect(calcularTransferenciasSocio({ ...base, movimentos: [movimento, saida, { ...saida, tipo: "ENTRADA" }] })).toBe(0);
  const transferencia = { ...movimento, pagamento_id: null, transferencia_conta_id: "t", valor: 200 };
  const envio = { ...transferencia, conta_bancaria_id: "pj", tipo: "SAIDA" };
  expect(calcularTransferenciasSocio({ ...base, movimentos: [transferencia, envio] })).toBe(200);
  expect(calcularTransferenciasSocio({ ...base, movimentos: [{ ...transferencia, tipo: "SAIDA" }, { ...envio, tipo: "ENTRADA" }] })).toBe(-200);
  expect(calcularTransferenciasSocio({ ...base, movimentos: [{ ...transferencia, data_movimento: "2026-11-01" }, envio] })).toBe(0);
});

it("separa imposto proporcional do crédito líquido do sócio", () => {
  const liquido = calcularComissaoRecebida(850, 1000, 400);
  const imposto = calcularComissaoRecebida(150, 1000, 400);
  expect(liquido).toBe(340);
  expect(imposto).toBe(60);
  expect(liquido + imposto).toBe(400);
});

it("exemplo do titular: 20 mil recebidos menos 2 mil de impostos e 10 mil de despesas deixam 8 mil", () => {
  const imposto = calcularComissaoRecebida(2000, 20000, 20000);
  const liquido = calcularComissaoRecebida(18000, 20000, 20000);
  const resultado = calcularFechamentoSocios({ despesasPagas: 20000, lucroConsultores: 0,
    reservaImpostos: imposto, caixaAntes: 20000, socios: [
      { id: "f", nome: "Fernando", percentual: 50, comissaoGuardada: liquido, adiantamentoPessoal: 0, saldoAnterior: 0, retirada: 0 },
      { id: "e", nome: "Eroni", percentual: 50, comissaoGuardada: 0, adiantamentoPessoal: 0, saldoAnterior: 0, retirada: 0 },
    ] });
  expect(liquido + imposto).toBe(20000);
  expect(resultado.socios[0].parteDespesas).toBe(10000);
  expect(resultado.socios[0].direitoAntesRetirada).toBe(8000);
});
