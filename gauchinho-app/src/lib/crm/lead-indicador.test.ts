import { expect, it, vi } from "vitest";
import { incluirIndicadoresDosLeads } from "./lead-indicador";

it("recupera quem indicou no check-in padrão e no SPL na mesma lista", async () => {
  const filtrarIds = vi.fn().mockReturnThis();
  const query = {
    select: vi.fn().mockReturnThis(),
    in: filtrarIds,
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
