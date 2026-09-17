import { describe, expect, it } from "vitest";
import {
  agruparCotasPorGrupo,
  calcularDistanciaPedra,
  calcularPedraPorLoteriaFederal,
  numeroCotaParaPedra,
  ordenarCotasPorProximidade,
  validarPrimeiroPremioFederal,
} from "./assembleias";

const cota = (id: string, numero: string, cliente = id, grupoId = "g1") => ({
  id,
  numero_cota: numero,
  cliente_nome: cliente,
  status: "ativa",
  grupo_id: grupoId,
});

describe("assembleias/pedras", () => {
  it("valida e calcula pedra de cada grupo pela Loteria Federal (igual no site)", () => {
    expect(validarPrimeiroPremioFederal("80246")).toBe(true);
    expect(validarPrimeiroPremioFederal("123")).toBe(false);
    expect(validarPrimeiroPremioFederal("ABCDE")).toBe(false);

    // 80246 mod 2000 = 246 (exemplo veículo)
    expect(calcularPedraPorLoteriaFederal("80246", 2000)).toBe(246);
    // 80246 mod 999 = 326 (exemplo imóvel)
    expect(calcularPedraPorLoteriaFederal("80246", 999)).toBe(326);
    // 95866 mod 999 = 961
    expect(calcularPedraPorLoteriaFederal("95866", 999)).toBe(961);
  });

  it("calcula distância seguindo a regra oficial do consórcio: sempre o número ou maior", () => {
    // Pedra 466 com grupo de 999 cotas
    const exata = calcularDistanciaPedra(466, 466, 999);
    expect(exata.distancia).toBe(0);
    expect(exata.posicaoFila).toBe("EXATA");

    const superior = calcularDistanciaPedra(468, 466, 999);
    expect(superior.distancia).toBe(2);
    expect(superior.posicaoFila).toBe("SUPERIOR");
    expect(superior.labelDiferenca).toBe("+2 (Superior)");

    // Cota 465 é menor que 466: só entra após o giro do grupo (wrap-around)
    const giro = calcularDistanciaPedra(465, 466, 999);
    expect(giro.distancia).toBe(998); // (999 - 466) + 465
    expect(giro.posicaoFila).toBe("GIRO");
    expect(giro.labelDiferenca).toContain("Após giro");
  });

  it("ordena cotas priorizando número sorteado e cotas superiores antes do giro", () => {
    // Cotas: 465, 466, 468 com pedra 466
    const resultado = ordenarCotasPorProximidade(
      [cota("menor", "465"), cota("exata", "466"), cota("maior", "468")],
      466,
      999,
    );

    // Ordem deve ser: 466 (exata), 468 (maior), 465 (após giro)
    expect(resultado.map((x) => x.id)).toEqual(["exata", "maior", "menor"]);
    expect(resultado[0].distancia).toBe(0);
    expect(resultado[1].distancia).toBe(2);
    expect(resultado[2].distancia).toBe(998);
  });

  it("ignora cota sem número inteiro real", () => {
    expect(numeroCotaParaPedra("12A")).toBeNull();
    expect(ordenarCotasPorProximidade([cota("a", "12A")], 10)).toEqual([]);
  });

  it("agrupa cotas por grupo e prioriza grupos com cotas sorteadas na pedra (distância 0)", () => {
    const grupos = [
      { id: "g1", codigo_grupo: "1001", modalidade: "IMÓVEL", quantidade_cotas_sorteio: 999 },
      { id: "g2", codigo_grupo: "1002", modalidade: "AUTO", quantidade_cotas_sorteio: 2000 },
      { id: "g3", codigo_grupo: "1003", modalidade: "MOTO", quantidade_cotas_sorteio: 1000 },
    ];

    const cotas = [
      cota("c1", "472", "Carlos", "g1"), // pedra 466 -> dif: 6 (+6 Superior)
      cota("c2", "466", "Fernanda", "g2"), // pedra 466 -> dif: 0 (sorteada!)
      cota("c3", "468", "Eroni", "g2"), // pedra 466 -> dif: 2 (+2 Superior)
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

