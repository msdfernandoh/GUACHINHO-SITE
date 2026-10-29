import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ numero: "66999991234" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from(table: string) {
    const query = { select() { return this; }, eq() { return this; }, async maybeSingle() {
      return { error: null, data: table === "eventos" ? { id: "evento", nome: "Ação", slug: "acao", ativo: true, publicado: true,
        data_evento: null, tipo_checkin: "externo", checkin_interativo_ativo: true, whatsapp_equipe: state.numero } : null };
    } };
    return query;
  },
}) }));
import { fetchPublicSorteioByEventoId } from "./public";
describe("contato público vem do evento resolvido", () => {
  it("mapeia o contato atualizado do evento para a view do check-in", async () => {
    expect((await fetchPublicSorteioByEventoId("evento", { requirePublicado: false }))?.whatsappEquipe).toBe("66999991234");
    state.numero = "11988887777";
    expect((await fetchPublicSorteioByEventoId("evento", { requirePublicado: false }))?.whatsappEquipe).toBe("11988887777");
  });
});
