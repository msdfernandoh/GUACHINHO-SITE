import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEventoQrFixoPath } from "./qr-fixo";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventoQrCheckinModal } from "@/components/admin/eventos/evento-qr-checkin-modal";

const state = vi.hoisted(() => ({
  slug: "externo", ativo: true,
  eventos: [] as Array<Record<string, string | boolean>>,
  falhaSorteio: false,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let rows = table === "qr_codes_unicos"
        ? [{ id: "qr-fixo", slug: state.slug, ativo: state.ativo, tipo_destino: state.slug === "externo" ? "externo" : "evento" }]
        : [...state.eventos];
      const filters: Array<[string, unknown]> = [];
      const orders: Array<[string, boolean]> = [];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
        order: (key: string, opts: { ascending: boolean }) => { orders.push([key, opts.ascending]); return query; },
        limit: () => query,
        maybeSingle: async () => {
          rows = rows.filter(row => filters.every(([key, value]) => row[key as keyof typeof row] === value));
          rows.sort((a, b) => {
            for (const [key, ascending] of orders) {
              const result = String(a[key as keyof typeof a]).localeCompare(String(b[key as keyof typeof b]));
              if (result) return ascending ? result : -result;
            }
            return 0;
          });
          return { data: rows[0] ?? null, error: null };
        },
      };
      return query;
    },
  }),
}));
vi.mock("./public", () => ({
  fetchPublicSorteioByEventoId: async (id: string) => state.falhaSorteio ? null : ({
    eventoId: id, npsPerguntas: [], checkinInterativoAtivo: true,
  }),
}));

import { resolveQrPublicBySlug } from "./qr-unico";

beforeEach(() => {
  state.slug = "externo";
  state.ativo = true;
  state.falhaSorteio = false;
  state.eventos = [
    { id: "externo-antigo", tipo_checkin: "externo", ativo: false, updated_at: "2026-10-22" },
    { id: "externo-atual", tipo_checkin: "externo", ativo: true, updated_at: "2026-10-21" },
    { id: "palestra-antiga", tipo_checkin: "evento", ativo: true, data_evento: "2026-09-22" },
    { id: "palestra-atual", tipo_checkin: "evento", ativo: true, data_evento: "2026-10-21" },
  ];
});

describe("QR fixo por modalidade", () => {
  it("renderiza no servidor sem window e sem oferecer QR por edição", () => {
    const html = renderToStaticMarkup(React.createElement(EventoQrCheckinModal, {
      evento: { id: "novo", nome: "Novo evento", slug: "nova-edicao", tipoCheckin: "externo" },
    }));
    expect(html).toContain("QR fixo");
    expect(html).not.toContain("QR Deste Evento");
    expect(html).not.toContain("/eventos/nova-edicao/sorteio");
  });
  it("mantém os endereços impressos independentes de cada edição", () => {
    expect(getEventoQrFixoPath("externo")).toBe("/qr/externo");
    expect(getEventoQrFixoPath("evento")).toBe("/qr/network");
    expect(getEventoQrFixoPath(null)).toBe("/qr/network");
  });

  it("abre a ação externa ativa, sem escolher palestra ou externo inativo", async () => {
    const result = await resolveQrPublicBySlug("externo");
    expect(result?.mode).toBe("evento");
    if (result?.mode !== "evento") throw new Error("Evento esperado");
    expect(result.sorteio.eventoId).toBe("externo-atual");
    expect(result.sorteio.tipoCheckin).toBe("externo");
  });

  it("troca o destino externo sem mudar o QR", async () => {
    state.eventos.push({ id: "novo-externo", tipo_checkin: "externo", ativo: true, updated_at: "2026-10-23" });
    const result = await resolveQrPublicBySlug("externo");
    expect(result?.mode === "evento" && result.sorteio.eventoId).toBe("novo-externo");
    expect(result?.qr.slug).toBe("externo");
  });

  it("reutiliza network para a palestra ativa mais recente sem vínculo manual", async () => {
    state.slug = "network";
    const result = await resolveQrPublicBySlug("network");
    expect(result?.mode === "evento" && result.sorteio.eventoId).toBe("palestra-atual");
    expect(result?.mode === "evento" && result.sorteio.tipoCheckin).toBe("evento");
  });

  it("não abre outra modalidade quando não há evento ativo correspondente", async () => {
    state.eventos = state.eventos.filter(row => row.tipo_checkin === "evento");
    expect(await resolveQrPublicBySlug("externo")).toMatchObject({ mode: "sem_evento", motivo: "sem_vinculo" });
  });

  it("respeita QR inativo e sorteio indisponível", async () => {
    state.ativo = false;
    expect(await resolveQrPublicBySlug("externo")).toMatchObject({ mode: "sem_evento", motivo: "inativo" });
    state.ativo = true;
    state.falhaSorteio = true;
    expect(await resolveQrPublicBySlug("externo")).toMatchObject({ mode: "sem_evento", motivo: "sorteio_indisponivel" });
  });
});
