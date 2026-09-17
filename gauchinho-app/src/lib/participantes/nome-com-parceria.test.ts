import { describe, expect, it } from "vitest";
import { nomeComPerfilComissao, nomeComTipoComissao } from "./nome-com-parceria";

describe("nomeComTipoComissao", () => {
  it("coloca o tipo de comissão antes do nome", () => {
    expect(nomeComTipoComissao("Ana", ["SDR"])).toBe("SDR · Ana");
    expect(nomeComTipoComissao("Bruno", ["SOCIO"])).toBe("Sócio · Bruno");
    expect(nomeComTipoComissao("Carla", ["INDICADOR"])).toBe("Indicação · Carla");
    expect(nomeComTipoComissao("Diego", ["GESTOR"])).toBe("Master · Diego");
  });
});

describe("nomeComPerfilComissao", () => {
  it("reflete o perfil de comissão vigente mesmo quando o papel técnico é legado", () => {
    expect(nomeComPerfilComissao("Eroni Bolfe", ["Sócio", "Sócio"], ["MICROFRANQUIA"]))
      .toBe("Sócio · Eroni Bolfe");
  });

  it("usa o papel técnico quando há mais de um perfil diferente", () => {
    expect(nomeComPerfilComissao("Fernando", ["Sócio", "Franquia Antiga"], ["GESTOR"]))
      .toBe("Master · Fernando");
  });
});
