import { expect, it, vi } from "vitest";
import { incluirIndicadoresDosLeads } from "./lead-indicador";

it("recupera quem indicou no check-in padrão e no SPL na mesma lista", async () => {
  const filtrarIds = vi.fn().mockReturnThis();
  const query = {
    select: vi.fn().mockReturnThis(),
    in: filtrarIds,
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({
      data: [
        { lead_id: "padrao", indicador: { nome: " Ana " } },
        { lead_id: "padrao", indicador: { nome: "Nome anterior" } },
      ],
    }),
  };
  const supabase = { from: vi.fn().mockReturnValue(query) } as unknown as
    Parameters<typeof incluirIndicadoresDosLeads>[0];

  const leads = await incluirIndicadoresDosLeads(supabase, [
    { id: "padrao", origem: "site" },
    { id: "spl", origem: "spl_portfolio", dados_simulacao: { spl: { indicado_por: " Bruno " } } },
    { id: "convite", origem: "evento", parceiro_indicador_nome: "Carla" },
    { id: "manual", origem: "indicacao", parceiro_indicador_nome: "Daniel" },
    { id: "novo", origem: "indicacao", dados_simulacao: {
      origem: "evento_nps_sorteio_indicacao", indicador_nome: "Eva",
    } },
  ]);

  expect(filtrarIds).toHaveBeenCalledWith("lead_id", ["padrao", "convite"]);
  expect(leads.map((lead) => lead.indicador_nome)).toEqual(["Ana", "Bruno", undefined, "Daniel", "Eva"]);
});

it("lê o histórico do check-in quando o banco ainda não tem a coluna lead_id nas indicações", async () => {
  const query = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    returns: vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "42703" } })
      .mockResolvedValueOnce({ data: [
        { lead_id: "legado", dados_evento: { indicador: " Ana " } },
        { lead_id: "legado", dados_evento: { indicador: "Nome anterior" } },
      ] }),
  };
  const from = vi.fn().mockReturnValue(query);
  const supabase = { from } as unknown as Parameters<typeof incluirIndicadoresDosLeads>[0];
  const leads = await incluirIndicadoresDosLeads(supabase, [
    { id: "legado", origem: "indicacao", parceiro_indicador_nome: null },
    { id: "direto", origem: "evento_checkin" },
  ]);

  expect(from).toHaveBeenNthCalledWith(2, "eventos_site");
  expect(query.eq).toHaveBeenCalledWith("pagina", "evento_nps_sorteio");
  expect(leads.map((lead) => lead.indicador_nome)).toEqual(["Ana", undefined]);
});
