import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("react", async () => {
  const real = await vi.importActual<typeof import("react")>("react");
  return { ...real, useState: (initial: unknown) => real.useState(initial === 1 ? "final" : initial) };
});
vi.mock("@/components/tenant/tenant-brand-context", () => ({ useTenantBrand: () => ({ corPrimaria: "#0066cc" }) }));
vi.mock("@/app/(public)/eventos/[slug]/sorteio/checkin-actions", () => ({ consultarCheckinAction: vi.fn(), submeterCheckinConversacionalAction: vi.fn() }));
import { EventoCheckinConversacional } from "@/components/public/eventos/evento-checkin-conversacional";

describe("contato do botão final", () => {
  it("renderiza o telefone configurado no evento e não o contato de outra edição", () => {
    const html = (numero: string | null) => renderToStaticMarkup(React.createElement(EventoCheckinConversacional, {
      evento: { id: "evento", nome: "Ação externa", slug: "acao", tipoCheckin: "externo", whatsappEquipe: numero }, isPreview: true,
    }));
    expect(html("66999991234")).toContain("https://wa.me/5566999991234?text=");
    expect(html("11988887777")).toContain("https://wa.me/5511988887777?text=");
    expect(html("11988887777")).not.toContain("https://wa.me/5566999991234");
    expect(html(null)).toContain("https://wa.me/5566999126120?text=");
  });
});
