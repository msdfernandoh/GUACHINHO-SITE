import { describe, expect, it } from "vitest";
import {
  createGrupoLinhaHandlers,
  parseRecursoProprioPercentualInput,
  parseRecursoProprioValorInput,
} from "@/components/public/grupos/use-grupo-linha";
import type { ConfigLinhaSimulacaoGrupo } from "@/lib/grupos/simulacao-linha";

describe("parseRecursoProprioValorInput", () => {
  it("interpreta máscara BRL", () => {
    expect(parseRecursoProprioValorInput("R$ 15.000,00")).toBe(15_000);
    expect(parseRecursoProprioValorInput("1.000,50")).toBe(1000.5);
  });

  it("aceita número simples sem máscara", () => {
    expect(parseRecursoProprioValorInput("15000")).toBe(15_000);
  });
});

describe("parseRecursoProprioPercentualInput", () => {
  it("aceita vírgula decimal", () => {
    expect(parseRecursoProprioPercentualInput("10,5")).toBe(10.5);
  });

  it("ativa o recurso próprio ao digitar o percentual sem exigir troca de modo", () => {
    const config: ConfigLinhaSimulacaoGrupo = {
      cotaId: "cota-1",
      quantidadeCotas: 1,
      modalidadeParcela: "integral",
      usaLanceEmbutido: false,
      modalidadeLanceId: null,
      usaRecursoProprio: false,
      recursoProprioModo: "percentual",
      recursoProprioInput: 0,
      usaSeguro: false,
      percentualParcelaPersonalizada: null,
    };
    let atualizado = config;
    const handlers = createGrupoLinhaHandlers(
      config,
      (next) => {
        atualizado = next;
      },
      [],
      0,
    );

    handlers.onRecursoInputChange("30");

    expect(atualizado.usaRecursoProprio).toBe(true);
    expect(atualizado.recursoProprioInput).toBe(30);
  });
});
