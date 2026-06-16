import { describe, expect, it } from "vitest";
import { deriveGrupoFlagsFromModalidades, legacyModalidadesFromGrupoRow } from "./modalidades-admin";

describe("deriveGrupoFlagsFromModalidades", () => {
  it("marca lance e reduzida a partir das estratégias", () => {
    const flags = deriveGrupoFlagsFromModalidades([
      {
        nome: "50% + reduzida",
        percentual_lance_embutido: 50,
        percentual_recurso_proprio_minimo: 10,
        ativo: true,
        ordem: 0,
        tipo_parcela: "reduzida",
        percentual_parcela_reduzida: 25,
      },
    ]);
    expect(flags.permite_lance_embutido).toBe(true);
    expect(flags.tem_parcela_reduzida).toBe(true);
    expect(flags.percentual_lance_embutido).toBe(50);
    expect(flags.percentual_parcela_reduzida).toBe(25);
  });
});

describe("legacyModalidadesFromGrupoRow", () => {
  it("gera linha a partir dos campos legados", () => {
    const rows = legacyModalidadesFromGrupoRow({
      permite_lance_embutido: true,
      percentual_lance_embutido: 30,
      tem_parcela_reduzida: true,
      percentual_parcela_reduzida: 25,
      percentual_recurso_proprio_sugerido: 5,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.percentual_lance_embutido).toBe(30);
  });
});
