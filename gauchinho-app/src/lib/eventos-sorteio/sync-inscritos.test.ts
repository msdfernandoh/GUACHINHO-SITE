import { describe, expect, it } from "vitest";
import { mapStatusEventoParaSorteio } from "./sync-inscritos";

describe("sync inscritos evento → sorteio", () => {
  it("mapeia status elegíveis para participando", () => {
    expect(mapStatusEventoParaSorteio("confirmado")).toBe("participando");
    expect(mapStatusEventoParaSorteio("presente")).toBe("participando");
    expect(mapStatusEventoParaSorteio("lista_espera")).toBe("participando");
  });

  it("mapeia cancelado/ausente para cancelado no sorteio", () => {
    expect(mapStatusEventoParaSorteio("cancelado")).toBe("cancelado");
    expect(mapStatusEventoParaSorteio("ausente")).toBe("cancelado");
  });
});
