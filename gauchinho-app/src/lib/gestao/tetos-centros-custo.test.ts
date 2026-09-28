import { describe, expect, it } from "vitest";
import { calcularTetosMensais, type ContaParaTeto } from "./tetos-centros-custo";

const conta = (campos: Partial<ContaParaTeto> = {}): ContaParaTeto => ({
  centro_custo_id: "operacao",
  valor: 100,
  status: "paga",
  pago_em: "2026-09-24",
  excluida_em: null,
  retirar_reserva_impostos: false,
  ...campos,
});

describe("teto mensal por centro de custo", () => {
  const centros = [
    { id: "operacao", nome: "Operação", ativo: true, limite_mensal: 1000 },
    { id: "marketing", nome: "Marketing", ativo: true, limite_mensal: 500 },
    { id: "sem-teto", nome: "Sem teto", ativo: true, limite_mensal: null },
  ];

  it("soma somente contas pagas no mês e ignora impostos, estornos e contas abertas", () => {
    const resultado = calcularTetosMensais(centros, [
      conta({ valor: 600 }),
      conta({ valor: 200, pago_em: "2026-09-28" }),
      conta({ valor: 5000, status: "aberta", pago_em: null }),
      conta({ valor: 900, pago_em: "2026-10-01" }),
      conta({ valor: 300, retirar_reserva_impostos: true }),
      conta({ valor: 150, excluida_em: "2026-09-27T10:00:00Z" }),
      conta({ valor: 501, centro_custo_id: "marketing" }),
    ], "2026-09");

    expect(resultado).toEqual([
      expect.objectContaining({ nome: "Marketing", gasto: 501, limite: 500, situacao: "ultrapassado" }),
      expect.objectContaining({ nome: "Operação", gasto: 800, limite: 1000, restante: 200, situacao: "atencao" }),
    ]);
  });

  it("mantém o centro dentro do teto quando o valor pago é inferior a 80%", () => {
    expect(calcularTetosMensais(centros, [conta({ valor: 799.99 })], "2026-09").find((item) => item.centroId === "operacao"))
      .toEqual(expect.objectContaining({ situacao: "dentro", gasto: 799.99, restante: 200.01 }));
  });
});
