import { describe, expect, it } from "vitest";
import { matchesConsultor, consultoresParaFiltro } from "./consultor-filter";
import type { LeadListRow } from "./types";

describe("filtro de consultor no Pipeline", () => {
  const options = [{ id: "atual", nome: "Ana", usuarioIds: ["atual", "legado"] }, { id: "homonimo", nome: "Ana" }];
  it("inclui IDs da mesma identidade e preserva homônimos separados", () => {
    expect(matchesConsultor({ srd_responsavel_id: "legado" }, "atual", options)).toBe(true);
    expect(matchesConsultor({ srd_responsavel_id: "homonimo" }, "atual", options)).toBe(false);
    expect(matchesConsultor({ srd_responsavel_id: null }, "atual", options)).toBe(false);
  });
  it("oferece vínculo histórico já atribuído sem duplicar opções existentes", () => {
    const leads = ["legado", "antigo", "antigo"].map(id => ({ srd_responsavel_id: id, srd_responsavel_nome: "Ana" }) as LeadListRow);
    const result = consultoresParaFiltro(options, leads);
    expect(result).toHaveLength(3);
    expect(matchesConsultor(leads[1], "antigo", result)).toBe(true);
    expect(matchesConsultor(leads[1], "", result)).toBe(true);
  });
});
