import { describe, expect, it } from "vitest";
import { buildLeadIndicacaoSorteioRow } from "./indicacoes";

describe("buildLeadIndicacaoSorteioRow", () => {
  it("usa nome e telefone do indicado como dados principais do lead", () => {
    const row = buildLeadIndicacaoSorteioRow({
      indicadoNome: "Maria Indicada",
      indicadoTelefone: "(66) 99999-1111",
      tipo: "amigo",
      indicadorNome: "João Indicador",
      indicadorTelefone: "(66) 98888-2222",
      indicadorLeadId: "lead-indicador",
      indicadorParticipanteId: "participante-indicador",
      sorteioId: "sorteio-1",
      eventoId: "evento-1",
      eventoNome: "Evento Teste",
      status: "Novo",
    });

    expect(row.nome).toBe("Maria Indicada");
    expect(row.whatsapp).toBe("(66) 99999-1111");
    expect(row.parceiro_indicador_nome).toBe("João Indicador");
    expect(row.parceiro_indicador_telefone).toBe("(66) 98888-2222");
    expect(row.indicador_lead_id).toBe("lead-indicador");
    expect(row.origem).toBe("indicacao");
    expect(row.evento_nome).toBe("Evento Teste");
  });

  it("registra a relação familiar sem substituir os dados do indicado", () => {
    const row = buildLeadIndicacaoSorteioRow({
      indicadoNome: "Ana Indicada",
      indicadoTelefone: "66999990000",
      tipo: "familiar",
      indicadorNome: "Carlos Indicador",
      indicadorTelefone: "66888880000",
      indicadorLeadId: null,
      indicadorParticipanteId: "participante-2",
      sorteioId: "sorteio-2",
      eventoId: "evento-2",
      eventoNome: null,
      status: "Novo",
    });

    expect(row.nome).toBe("Ana Indicada");
    expect(row.whatsapp).toBe("66999990000");
    expect(row.parentesco_indicacao).toBe("familiar");
    expect(row.observacao_indicacao).toContain("Familiar");
  });
});
