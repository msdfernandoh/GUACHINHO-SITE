import { describe, expect, it } from "vitest";
import { deduplicarCatalogoGrupos, deduplicarSolicitacoesGrupos } from "./grupos-listagem";

describe("listagem defensiva de grupos da Platform", () => {
  it("renderiza uma única linha por administradora e código normalizado", () => {
    const rows = deduplicarCatalogoGrupos([
      { id: "local", administradora_id: "a", codigo_grupo: "1553  imóvel", origem_governanca: "LOCAL" },
      { id: "global", administradora_id: "a", codigo_grupo: " 1553 IMÓVEL ", origem_governanca: "GLOBAL" },
      { id: "outra", administradora_id: "b", codigo_grupo: "1553 IMÓVEL", origem_governanca: "GLOBAL" },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["global", "outra"]);
  });

  it("renderiza uma única aprovação por grupo", () => {
    const rows = deduplicarSolicitacoesGrupos([
      { id: "primeira", grupo_id: "g1", codigo_grupo: "1553" },
      { id: "repetida", grupo_id: "g1", codigo_grupo: "1553" },
      { id: "segunda", grupo_id: "g2", codigo_grupo: "1554" },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["primeira", "segunda"]);
  });
});
