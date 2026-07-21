import { describe, expect, it } from "vitest";
import { filterLeadsByScope, leadVisibleForScope, type LeadAccessScope } from "./lead-access";
import type { LeadListRow } from "./types";

function scope(partial: Partial<LeadAccessScope> & Pick<LeadAccessScope, "usuarioId" | "perfil">): LeadAccessScope {
  return {
    leadsApenasProprios: false,
    eventosRestritos: new Map(),
    ...partial,
  };
}

function lead(
  partial: Partial<Pick<LeadListRow, "srd_responsavel_id" | "evento_id">> & { id?: string },
): LeadListRow & { evento_id?: string | null } {
  return {
    id: partial.id ?? "l1",
    created_at: "",
    nome: "Lead",
    whatsapp: null,
    email: null,
    cidade: null,
    origem: null,
    tipo_interesse: null,
    produto_interesse: null,
    status: "novo",
    temperatura: null,
    srd_responsavel_id: partial.srd_responsavel_id ?? null,
    srd_responsavel_nome: null,
    proxima_acao: null,
    data_proxima_acao: null,
    proximo_retorno_data: null,
    ultima_interacao_at: null,
    valor_estimado: null,
    valor_simulado: null,
    fechado: false,
    evento_id: partial.evento_id ?? null,
  } as LeadListRow & { evento_id?: string | null };
}

describe("leadVisibleForScope", () => {
  it("visão restrita: só leads atribuídos ao usuário", () => {
    const s = scope({
      usuarioId: "u1",
      perfil: "srd",
      leadsApenasProprios: true,
      eventosRestritos: new Map([["ev1", new Set(["u1"])]]),
    });
    expect(leadVisibleForScope(lead({ srd_responsavel_id: "u1" }), s)).toBe(true);
    expect(leadVisibleForScope(lead({ srd_responsavel_id: "u2" }), s)).toBe(false);
    expect(leadVisibleForScope(lead({ srd_responsavel_id: null, evento_id: "ev1" }), s)).toBe(false);
    expect(leadVisibleForScope(lead({ srd_responsavel_id: "u2", evento_id: "ev1" }), s)).toBe(false);
  });

  it("visão completa + evento restrito: só allow-list", () => {
    const s = scope({
      usuarioId: "u1",
      perfil: "srd",
      leadsApenasProprios: false,
      eventosRestritos: new Map([["ev1", new Set(["u1"])]]),
    });
    expect(leadVisibleForScope(lead({ evento_id: "ev1", srd_responsavel_id: "u2" }), s)).toBe(true);
    expect(
      leadVisibleForScope(
        lead({ evento_id: "ev1", srd_responsavel_id: "u2" }),
        scope({ usuarioId: "u3", perfil: "srd", eventosRestritos: s.eventosRestritos }),
      ),
    ).toBe(false);
  });

  it("master com visão completa vê tudo", () => {
    const rows = [
      lead({ id: "a", srd_responsavel_id: "u2" }),
      lead({ id: "b", srd_responsavel_id: null }),
    ];
    const filtered = filterLeadsByScope(
      rows,
      scope({ usuarioId: "master1", perfil: "master", leadsApenasProprios: false }),
    );
    expect(filtered).toHaveLength(2);
  });

  it("master com só leads próprios também fica restrito", () => {
    const rows = [
      lead({ id: "a", srd_responsavel_id: "master1" }),
      lead({ id: "b", srd_responsavel_id: "u2" }),
    ];
    const filtered = filterLeadsByScope(
      rows,
      scope({ usuarioId: "master1", perfil: "master", leadsApenasProprios: true }),
    );
    expect(filtered.map((r) => r.id)).toEqual(["a"]);
  });
});
