import { describe, expect, it } from "vitest";
import { numeroCotaParaPedra, ordenarCotasPorProximidade } from "./assembleias";

const cota = (id: string, numero: string, cliente = id) => ({ id, numero_cota: numero, cliente_nome: cliente, status: "ativa" });

describe("assembleias/pedras", () => {
  it("ordena por distância e desempata pelo número da cota", () => {
    expect(ordenarCotasPorProximidade([cota("a", "1254"), cota("b", "1246"), cota("c", "1247")], 1250).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("ignora cota sem número inteiro real", () => {
    expect(numeroCotaParaPedra("12A")).toBeNull();
    expect(ordenarCotasPorProximidade([cota("a", "12A")], 10)).toEqual([]);
  });
});
