import { describe, expect, it } from "vitest";
import {
  EMPRESA_B_ID,
  GAUCHINHO_EMPRESA_ID,
  RACON_ADMINISTRADORA_ID,
  RACON_SLUG,
} from "@/lib/administradoras/constants";
import {
  buildGrupoAdministradoraDualWrite,
  isLegacyRaconText,
  resolveAdministradoraCandidateFromForm,
  resolveGrupoAdministradora,
  raconAdministradoraId,
} from "./administradora";

const racon = {
  id: RACON_ADMINISTRADORA_ID,
  nome: "Racon",
  nome_fantasia: "Racon",
  slug: RACON_SLUG,
  status: "ATIVA" as const,
};

describe("resolveGrupoAdministradora", () => {
  it("usa UUID como fonte estrutural", () => {
    const r = resolveGrupoAdministradora({
      administradora_id: RACON_ADMINISTRADORA_ID,
      administradora: "RACON",
    });
    expect(r.fromUuid).toBe(true);
    expect(r.legacyFallback).toBe(false);
    expect(r.administradora_id).toBe(RACON_ADMINISTRADORA_ID);
    expect(r.display).toBe("RACON");
  });

  it("fallback legado quando sem UUID", () => {
    const r = resolveGrupoAdministradora({
      administradora_id: null,
      administradora: "Racon",
    });
    expect(r.fromUuid).toBe(false);
    expect(r.legacyFallback).toBe(true);
    expect(r.administradora_id).toBeNull();
    expect(r.display).toBe("Racon");
  });

  it("rejeita UUID inválido", () => {
    expect(() =>
      resolveGrupoAdministradora({ administradora_id: "not-a-uuid", administradora: "X" }),
    ).toThrow(/inválido/i);
  });

  it("rejeita UUID inexistente no catálogo informado", () => {
    expect(() =>
      resolveGrupoAdministradora(
        { administradora_id: RACON_ADMINISTRADORA_ID, administradora: "Racon" },
        new Map(),
      ),
    ).toThrow(/não encontrada/i);
  });
});

describe("dual-write", () => {
  it("grava UUID + preserva texto legado RACON", () => {
    const d = buildGrupoAdministradoraDualWrite({
      administradoraId: RACON_ADMINISTRADORA_ID,
      administradora: racon,
      existingText: "RACON",
      requestedText: "RACON",
    });
    expect(d.administradora_id).toBe(RACON_ADMINISTRADORA_ID);
    expect(d.administradora).toBe("RACON");
  });

  it("usa nome canônico quando não há legado", () => {
    const d = buildGrupoAdministradoraDualWrite({
      administradoraId: RACON_ADMINISTRADORA_ID,
      administradora: racon,
    });
    expect(d.administradora).toBe("Racon");
  });

  it("não aceita texto arbitrário sem UUID", () => {
    expect(() =>
      resolveAdministradoraCandidateFromForm({
        administradoraTextRaw: "Outra Admin Qualquer",
      }),
    ).toThrow(/não reconhecido/i);
  });

  it("aceita alias legado Racon", () => {
    expect(resolveAdministradoraCandidateFromForm({ administradoraTextRaw: "RACON" })).toEqual({
      mode: "legacy_racon",
    });
    expect(isLegacyRaconText("Racon")).toBe(true);
  });

  it("rejeita administradora global INATIVA", () => {
    expect(() =>
      buildGrupoAdministradoraDualWrite({
        administradoraId: RACON_ADMINISTRADORA_ID,
        administradora: { ...racon, status: "INATIVA" },
      }),
    ).toThrow(/INATIVA/i);
  });
});

describe("terminologia / escopo", () => {
  it("Racon é administradora; Gauchinho e Empresa B são tenants distintos", () => {
    expect(raconAdministradoraId()).toBe(RACON_ADMINISTRADORA_ID);
    expect(RACON_ADMINISTRADORA_ID).not.toBe(GAUCHINHO_EMPRESA_ID);
    expect(RACON_ADMINISTRADORA_ID).not.toBe(EMPRESA_B_ID);
  });

  it("grupos_cotas herdam administradora via grupo (sem coluna própria nesta E5)", () => {
    // Contrato estrutural documentado: cotas → grupo_id → grupos_consorcio.administradora_id
    const grupo = {
      id: "g1",
      administradora_id: RACON_ADMINISTRADORA_ID,
      administradora: "RACON",
    };
    const cota = { id: "c1", grupo_id: grupo.id };
    const resolved = resolveGrupoAdministradora(grupo);
    expect(cota.grupo_id).toBe(grupo.id);
    expect(resolved.administradora_id).toBe(RACON_ADMINISTRADORA_ID);
  });
});
