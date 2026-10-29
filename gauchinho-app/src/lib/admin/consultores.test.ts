import { describe, expect, it } from "vitest";
import { consultoresDosVinculos, listarConsultores, resolverConsultorPorId } from "./consultores";

function mockSupabase(responses: Array<{ data: unknown; error: { message: string } | null }>) {
  let i = 0;
  return {
    from: () => ({
      select: () => {
        const chain = {
          eq: () => chain,
          in: () => chain,
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

describe("consultores por vínculo ativo no tenant", () => {
  const usuario = { id: "u1", nome: "Ana", ativo: true, auth_user_id: "auth1" };
  it("consolida papéis do mesmo usuário e contas vinculadas à mesma identidade", () => {
    const rows = consultoresDosVinculos([
      { usuario, papel: { codigo: "gestor" } },
      { usuario, papel: { codigo: "consultor" } },
      { usuario: { ...usuario, id: "legado" }, papel: { codigo: "consultor" } },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].is_consultor).toBe(true);
  });
  it("exclui usuários inativos e perfis sem elegibilidade sem juntar homônimos", () => {
    const rows = consultoresDosVinculos([
      { usuario: { ...usuario, ativo: false }, is_consultor: true },
      { usuario, papel: { codigo: "indicador" } },
      { usuario, papel: { codigo: "consultor" } },
      { usuario: { ...usuario, id: "u2", auth_user_id: "auth2" }, papel: { codigo: "consultor" } },
    ]);
    expect(rows.map(r => r.id)).toEqual(["u1", "u2"]);
  });
  it("resolver aceita múltiplos papéis, mas rejeita participante comercial inativo", async () => {
    function db(status: string) {
      return { from(table: string) {
        const query = { select() { return this; }, eq() { return this; },
          then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ error: null, data: table === "empresa_usuarios"
            ? [{ usuario, papel: { codigo: "gestor" } }, { usuario, papel: { codigo: "consultor" } }]
            : [{ status }] })); } };
        return query;
      } };
    }
    expect(await resolverConsultorPorId(db("ATIVO") as never, "u1", "empresa")).toMatchObject({ id: "u1" });
    expect(await resolverConsultorPorId(db("INATIVO") as never, "u1", "empresa")).toBeNull();
  });
});
