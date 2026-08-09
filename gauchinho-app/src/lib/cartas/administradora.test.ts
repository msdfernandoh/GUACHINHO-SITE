import { describe, expect, it } from "vitest";
import {
  isMissingCartaAdministradoraIdColumn,
  resolveCartaAdministradora,
  withoutCartaAdministradoraId,
} from "./administradora";

const RACON_UUID = "c5f8ecb4-cb5a-5014-b567-50484719b404";
const options = [
  {
    id: RACON_UUID,
    nome: "Racon",
    nome_fantasia: "Racon Consórcios",
    razao_social: "Racon Administradora de Consórcios Ltda.",
    status: "ATIVA",
  },
];

describe("dual-write de administradora em cartas", () => {
  it("resolve texto legado para UUID e snapshot canônico", () => {
    expect(resolveCartaAdministradora({ administradora: " RACON " }, options)).toEqual({
      administradora_id: RACON_UUID,
      administradora: "Racon",
    });
  });

  it("resolve UUID estrutural e preserva snapshot canônico", () => {
    expect(
      resolveCartaAdministradora(
        { administradoraId: RACON_UUID, administradora: "Racon Consórcios" },
        options,
      ),
    ).toEqual({ administradora_id: RACON_UUID, administradora: "Racon" });
  });

  it("rejeita texto arbitrário", () => {
    expect(() => resolveCartaAdministradora({ administradora: "Inventada" }, options)).toThrow(
      "Administradora inválida ou inativa.",
    );
  });

  it("rejeita UUID e texto conflitantes", () => {
    expect(() =>
      resolveCartaAdministradora(
        { administradoraId: RACON_UUID, administradora: "Outra" },
        options,
      ),
    ).toThrow("Administradora inválida ou inativa.");
  });

  it("detecta somente erro de coluna ausente da transição pré-050", () => {
    expect(
      isMissingCartaAdministradoraIdColumn(
        "Could not find the 'administradora_id' column of 'cartas_contempladas' in the schema cache",
      ),
    ).toBe(true);
    expect(isMissingCartaAdministradoraIdColumn("permission denied")).toBe(false);
  });

  it("fallback pré-050 remove apenas a coluna estrutural", () => {
    expect(
      withoutCartaAdministradoraId({
        administradora_id: RACON_UUID,
        administradora: "Racon",
        credito: 100,
      }),
    ).toEqual({ administradora: "Racon", credito: 100 });
  });
});
