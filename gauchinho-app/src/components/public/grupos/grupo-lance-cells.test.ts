import { describe, expect, it } from "vitest";
import { embutidoSelectValue } from "@/components/public/grupos/grupo-lance-cells";
import { defaultConfigLinha } from "@/lib/grupos/simulacao-linha";
import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";

describe("embutidoSelectValue", () => {
  it("mostra Sem embutido quando usaLanceEmbutido é false", () => {
    expect(
      embutidoSelectValue({
        cotaId: "1",
        quantidadeCotas: 1,
        modalidadeParcela: "integral",
        usaLanceEmbutido: false,
        modalidadeLanceId: "mod-25",
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: false,
      }),
    ).toBe("__sem__");
  });

  it("com uma modalidade cadastrada, default pode vir com embutido mas select permite sem", () => {
    const grupo = {
      id: "g1",
      permite_lance_embutido: true,
      percentual_lance_embutido: 25,
      tem_parcela_reduzida: false,
    } as GrupoConsorcio;
    const mods = [
      {
        id: "m1",
        grupo_id: "g1",
        nome: "25% embutido",
        percentual_lance_embutido: 25,
        percentual_recurso_proprio_minimo: 0,
        ativo: true,
        ordem: 0,
      },
    ] as GrupoModalidadeLance[];
    const cfg = defaultConfigLinha(grupo, [{ id: "c1" } as GrupoCota], mods);
    expect(cfg.usaLanceEmbutido).toBe(true);
    expect(embutidoSelectValue({ ...cfg, usaLanceEmbutido: false, modalidadeLanceId: null })).toBe(
      "__sem__",
    );
  });
});
