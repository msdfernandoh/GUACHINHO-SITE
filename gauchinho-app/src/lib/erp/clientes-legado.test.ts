import { describe, expect, it } from "vitest";
import { dataParcelaLegado, parseClientesLegado } from "./clientes-legado";

describe("importação de clientes legados", () => {
  it("aceita CPF e telefone vazios sem descartar a linha", () => {
    const parsed = parseClientesLegado([
      ["Cliente", "CPF CNPJ", "Contato", "Administradora", "Bem", "Data contrato", "Grupo", "Cota", "Valor"],
      ["Cliente sem documento", null, null, "RACON", "Imovel", "10/01/2024", "1403", "260", "R$ 205.000,00"],
    ]);
    expect(parsed.erros).toEqual([]);
    expect(parsed.linhas).toHaveLength(1);
    expect(parsed.linhas[0]).toMatchObject({ cpf_cnpj: "", telefone: "", valor_credito: 205000 });
  });

  it("aplica a regra de vencimento antes, no e depois do dia 10", () => {
    expect(dataParcelaLegado("2024-01-09", 1)).toBe("2024-01-09");
    expect(dataParcelaLegado("2024-01-09", 2)).toBe("2024-02-10");
    expect(dataParcelaLegado("2024-01-10", 2)).toBe("2024-02-10");
    expect(dataParcelaLegado("2024-01-11", 2)).toBe("2024-03-10");
    expect(dataParcelaLegado("2024-01-11", 18)).toBe("2025-07-10");
  });
});
