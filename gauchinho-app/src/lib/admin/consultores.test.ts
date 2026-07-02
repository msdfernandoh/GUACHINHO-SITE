import { describe, expect, it } from "vitest";
import { listarConsultores } from "./consultores";

function mockSupabase(responses: Array<{ data: unknown; error: { message: string } | null }>) {
  let i = 0;
  return {
    from: () => ({
      select: () => {
        const chain = {
          eq: () => chain,
          order: async () => {
            const r = responses[i] ?? { data: [], error: null };
            i += 1;
            return r;
          },
        };
        return chain;
      },
    }),
  };
}

describe("listarConsultores", () => {
  it("retorna consultores com is_consultor", async () => {
    const supabase = mockSupabase([{ data: [{ id: "1", nome: "Ana" }], error: null }]);
    const rows = await listarConsultores(supabase as never);
    expect(rows).toHaveLength(1);
  });

  it("fallback srd se coluna is_consultor ausente", async () => {
    const supabase = mockSupabase([
      { data: null, error: { message: "column is_consultor does not exist" } },
      { data: [{ id: "2", nome: "Legado" }], error: null },
    ]);
    const rows = await listarConsultores(supabase as never);
    expect(rows[0]?.nome).toBe("Legado");
  });
});
