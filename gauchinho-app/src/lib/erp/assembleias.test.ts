import { describe, expect, it } from "vitest";
import { agruparCotasPorGrupo, numeroCotaParaPedra, ordenarCotasPorProximidade } from "./assembleias";

const cota = (id: string, numero: string, cliente = id, grupoId = "g1") => ({
  id,
  numero_cota: numero,
  cliente_nome: cliente,
  status: "ativa",
  grupo_id: grupoId,
});

describe("assembleias/pedras", () => {
  it("ordena por distância e desempata pelo número da cota", () => {
    expect(ordenarCotasPorProximidade([cota("a", "1254"), cota("b", "1246"), cota("c", "1247")], 1250).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("ignora cota sem número inteiro real", () => {
    expect(numeroCotaParaPedra("12A")).toBeNull();
    expect(ordenarCotasPorProximidade([cota("a", "12A")], 10)).toEqual([]);
  });

  it("agrupa cotas por grupo e prioriza grupos com cotas sorteadas na pedra (distância 0)", () => {
    const grupos = [
      { id: "g1", codigo_grupo: "1001", modalidade: "IMÓVEL" },
      { id: "g2", codigo_grupo: "1002", modalidade: "AUTO" },
      { id: "g3", codigo_grupo: "1003", modalidade: "MOTO" },
    ];

    const cotas = [
      cota("c1", "460", "Carlos", "g1"), // dif: 6
      cota("c2", "466", "Fernanda", "g2"), // dif: 0 (sorteada!)
      cota("c3", "468", "Eroni", "g2"), // dif: 2
    ];

    const assembleiaMap = new Map([
      ["g1", "ass-1"],
      ["g2", "ass-2"],
      ["g3", "ass-3"],
    ]);

    const resultado = agruparCotasPorGrupo(grupos, cotas, 466, assembleiaMap);

    expect(resultado).toHaveLength(3);
    // g2 deve ser o primeiro pois possui cota sorteada na pedra (dif 0)
    expect(resultado[0].grupoId).toBe("g2");
    expect(resultado[0].possuiContempladaPedra).toBe(true);
    expect(resultado[0].menorDistancia).toBe(0);
    expect(resultado[0].cotas[0].id).toBe("c2");
    expect(resultado[0].assembleiaId).toBe("ass-2");

    // g1 deve ser o segundo (possui cota com dif 6)
    expect(resultado[1].grupoId).toBe("g1");
    expect(resultado[1].possuiContempladaPedra).toBe(false);
    expect(resultado[1].menorDistancia).toBe(6);

    // g3 deve ser o terceiro (sem cotas cadastradas)
    expect(resultado[2].grupoId).toBe("g3");
    expect(resultado[2].cotas).toHaveLength(0);
    expect(resultado[2].menorDistancia).toBeNull();
  });
});

