import { describe, expect, it } from "vitest";
import { nomeComTipoComissao } from "./nome-com-parceria";

describe("nomeComTipoComissao", () => {
  it("coloca o tipo de comissão antes do nome", () => {
    expect(nomeComTipoComissao("Ana", ["SDR"])).toBe("SDR · Ana");
    expect(nomeComTipoComissao("Bruno", ["SOCIO"])).toBe("Sócio · Bruno");
    expect(nomeComTipoComissao("Carla", ["INDICADOR"])).toBe("Indicação · Carla");
    expect(nomeComTipoComissao("Diego", ["GESTOR"])).toBe("Master · Diego");
  });
});
