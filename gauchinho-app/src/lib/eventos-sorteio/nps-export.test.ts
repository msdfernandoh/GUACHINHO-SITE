import { describe, expect, it } from "vitest";
import { buildNpsExportRow, formatNpsRespostaExport, npsDashboardToSemicolonTable } from "./nps-export";
import type { NpsDashboardData, NpsRespostaRow } from "./nps-dashboard";

const baseData = (): NpsDashboardData => ({
  eventoId: "ev1",
  eventoNome: "Evento Teste",
  totalCadastros: 1,
  totalComNps: 1,
  totalIndicacoes: 0,
  totalCuponsIndicacao: 0,
  scoreNps: 100,
  mediaRecomendacao: 10,
  promotores: 1,
  passivos: 0,
  detratores: 0,
  dimensoes: [],
  distribuicaoRecomendacao: [],
  contatoSim: 1,
  contatoNao: 0,
  perguntasColunas: [
    { chave: "recomendacao_evento", titulo: "Recomendação", tipo: "escala_0_10" },
    { chave: "contato_diagnostico", titulo: "Diagnóstico", tipo: "sim_nao" },
    { chave: "comentario", titulo: "Comentário", tipo: "texto" },
  ],
  respostas: [
    {
      participanteId: "p1",
      nome: "Maria",
      telefone: "51999998888",
      codigo: "001",
      valorMensalDisponivel: 1500,
      npsCompletoEm: "2026-01-15T12:00:00.000Z",
      recomendacao: 10,
      contatoDiagnostico: true,
      comentario: "Ótimo evento",
      respostas: {
        recomendacao_evento: 10,
        contato_diagnostico: true,
        comentario: "Ótimo evento",
      },
    },
  ],
  indicacoes: [],
});

describe("formatNpsRespostaExport", () => {
  it("formata escala, sim/não e texto", () => {
    expect(formatNpsRespostaExport("escala_0_10", 8)).toBe("8");
    expect(formatNpsRespostaExport("sim_nao", true)).toBe("Sim");
    expect(formatNpsRespostaExport("sim_nao", false)).toBe("Não");
    expect(formatNpsRespostaExport("texto", "  ok  ")).toBe("ok");
  });
});

describe("npsDashboardToSemicolonTable", () => {
  it("inclui colunas fixas e perguntas", () => {
    const table = npsDashboardToSemicolonTable(baseData());
    const lines = table.split("\n");
    expect(lines[0]).toBe("Respostas NPS");
    expect(lines[1]).toContain("Nome");
    expect(lines[1]).toContain("Valor disponível para investimento");
    expect(lines[1]).toContain("Recomendação");
    expect(lines[2]).toContain("Maria");
    expect(lines[2]).toContain("R$");
    expect(lines[2]).toContain("10");
    expect(lines[2]).toContain("Sim");
    expect(lines[2]).toContain("Ótimo evento");
  });

  it("inclui seção de indicações", () => {
    const data = baseData();
    data.totalIndicacoes = 1;
    data.indicacoes = [
      {
        id: "i1",
        nome: "Pedro",
        tipo: "amigo",
        telefone: "51988887777",
        cupomGerado: true,
        indicadorNome: "Maria",
        indicadorTelefone: "51999998888",
        createdAt: "2026-01-16T10:00:00.000Z",
      },
    ];
    const table = npsDashboardToSemicolonTable(data);
    expect(table).toContain("Indicações");
    expect(table).toContain("Pedro");
    expect(table).toContain("Maria");
    expect(table).toContain("Cupom gerado");
  });

  it("monta linha na ordem das perguntas", () => {
    const row: NpsRespostaRow = baseData().respostas[0]!;
    const cells = buildNpsExportRow(row, baseData().perguntasColunas);
    expect(cells[0]).toBe("Maria");
    expect(cells[cells.length - 1]).toBe("Ótimo evento");
  });
});
