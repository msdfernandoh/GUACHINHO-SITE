import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/admin/eventos/actions", () => ({ alternarModoCheckinAction: vi.fn(), uploadEventoImagemAction: vi.fn() }));
import { EventoAdminForm } from "@/components/admin/eventos/evento-admin-form";

describe("campo de contato no cadastro do evento", () => {
  it("mostra telefone mascarado no topo do evento externo", () => {
    const html = renderToStaticMarkup(React.createElement(EventoAdminForm, {
      evento: { id: "evento", tipo_checkin: "externo", nome: "Ação", whatsapp_equipe: "66999991234" } as never,
      action: async () => {},
    }));
    expect(html).toContain('name="whatsapp_equipe"');
    expect(html).toContain('type="tel"');
    expect(html).toContain('value="(66) 99999-1234"');
    expect(html.indexOf('name="whatsapp_equipe"')).toBeLessThan(html.indexOf('name="nome"'));
  });
  it("não apresenta contato de evento externo no cadastro de palestra", () => {
    const html = renderToStaticMarkup(React.createElement(EventoAdminForm, {
      evento: { id: "evento", tipo_checkin: "evento", nome: "Palestra" } as never,
      action: async () => {},
    }));
    expect(html).not.toContain('name="whatsapp_equipe"');
  });
});
