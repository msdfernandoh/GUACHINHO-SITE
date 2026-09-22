import { describe, expect, it } from "vitest";
import {
  calcularResumoParticipantes,
  filtrarParticipantes,
  type EnrichedEventoParticipante,
} from "./participantes-enriquecidos";

function mockParticipante(
  override: Partial<EnrichedEventoParticipante> = {}
): EnrichedEventoParticipante {
  return {
    id: "part-1",
    evento_id: "evt-1",
    lead_id: "lead-1",
    nome_participante: "Carlos Alberto",
    telefone_participante: "(65) 99988-7766",
    tem_acompanhante: false,
    nome_acompanhante: null,
    telefone_acompanhante: null,
    nome_convidou: "Consultor João",
    empresa_convidou: "Gauchinho",
    observacao: null,
    quantidade_vagas: 1,
    status: "confirmado",
    created_at: "2026-09-12T12:00:00.000Z",
    checkin_at: "2026-09-12T19:30:00.000Z",
    codigo_sorteio: "1001",
    veiculo: "carro",
    veiculo_label: "Carro",
    moradia: "aluguel",
    moradia_label: "Moro de aluguel",
    investimento: "1000_2000",
    investimento_label: "R$ 1.000 a R$ 2.000",
    avaliacao_encontro: "gostei_bastante",
    avaliacao_encontro_label: "Gostei bastante e fez sentido para mim",
    avaliacao_melhoria: null,
    momento_oportunidade: "simulacao_agora",
    momento_oportunidade_label: "Quero fazer uma simulação agora, de acordo com meus objetivos e necessidades",
    ...override,
  };
}

describe("calcularResumoParticipantes", () => {
  it("computa totais e contagens de perfil comercial corretamente", () => {
    const lista: EnrichedEventoParticipante[] = [
      mockParticipante({
        id: "1",
        status: "confirmado",
        checkin_at: "2026-09-12T19:00:00Z",
        codigo_sorteio: "1001",
        veiculo: "carro",
        moradia: "aluguel",
        investimento: "1000_2000",
      }),
      mockParticipante({
        id: "2",
        status: "presente",
        checkin_at: "2026-09-12T19:15:00Z",
        codigo_sorteio: "1002",
        veiculo: "moto",
        moradia: "propria_quitada",
        investimento: "acima_2000",
      }),
      mockParticipante({
        id: "3",
        status: "convidado",
        checkin_at: null,
        codigo_sorteio: null,
        veiculo: "nenhum",
        moradia: "propria_financiada",
        investimento: "ate_500",
      }),
    ];

    const resumo = calcularResumoParticipantes(lista);

    expect(resumo.totalConvidados).toBe(3);
    expect(resumo.confirmados).toBe(1);
    expect(resumo.presentes).toBe(1);
    expect(resumo.checkins).toBe(2);
    expect(resumo.comVeiculo).toBe(2); // carro e moto
    expect(resumo.aluguel).toBe(1);
    expect(resumo.investimentoAcima1k).toBe(2); // 1000_2000 e acima_2000
  });

  it("retorna zeros com segurança para lista vazia", () => {
    const resumo = calcularResumoParticipantes([]);
    expect(resumo.totalConvidados).toBe(0);
    expect(resumo.confirmados).toBe(0);
    expect(resumo.presentes).toBe(0);
    expect(resumo.checkins).toBe(0);
    expect(resumo.comVeiculo).toBe(0);
    expect(resumo.aluguel).toBe(0);
    expect(resumo.investimentoAcima1k).toBe(0);
  });
});

describe("filtrarParticipantes", () => {
  const lista: EnrichedEventoParticipante[] = [
    mockParticipante({
      id: "1",
      nome_participante: "Maria Silva",
      telefone_participante: "(65) 99999-1111",
      codigo_sorteio: "0100",
      veiculo: "carro",
      moradia: "aluguel",
      investimento: "500_1000",
      status: "confirmado",
      checkin_at: "2026-09-12T18:00:00Z",
      tem_acompanhante: true,
      nome_convidou: "Corretor Carlos",
    }),
    mockParticipante({
      id: "2",
      nome_participante: "José Santos",
      telefone_participante: "(66) 98888-2222",
      codigo_sorteio: "0200",
      veiculo: "moto",
      moradia: "propria_quitada",
      investimento: "acima_2000",
      status: "presente",
      checkin_at: "2026-09-12T18:30:00Z",
      tem_acompanhante: false,
      nome_convidou: "Consultora Ana",
    }),
    mockParticipante({
      id: "3",
      nome_participante: "Fernanda Lima",
      telefone_participante: "(65) 97777-3333",
      codigo_sorteio: null,
      veiculo: null,
      moradia: null,
      investimento: null,
      status: "convidado",
      checkin_at: null,
      tem_acompanhante: false,
      nome_convidou: "Corretor Carlos",
    }),
  ];

  it("filtra por status", () => {
    const res = filtrarParticipantes(lista, { status: "presente" });
    expect(res).toHaveLength(1);
    expect(res[0].nome_participante).toBe("José Santos");
  });

  it("filtra por check-in sim/nao", () => {
    const fezCheckin = filtrarParticipantes(lista, { checkin: "sim" });
    expect(fezCheckin).toHaveLength(2);

    const semCheckin = filtrarParticipantes(lista, { checkin: "nao" });
    expect(semCheckin).toHaveLength(1);
    expect(semCheckin[0].nome_participante).toBe("Fernanda Lima");
  });

  it("filtra por veículo", () => {
    const res = filtrarParticipantes(lista, { veiculo: "carro" });
    expect(res).toHaveLength(1);
    expect(res[0].nome_participante).toBe("Maria Silva");
  });

  it("filtra por moradia", () => {
    const res = filtrarParticipantes(lista, { moradia: "aluguel" });
    expect(res).toHaveLength(1);
    expect(res[0].nome_participante).toBe("Maria Silva");
  });

  it("filtra por capacidade de investimento", () => {
    const res = filtrarParticipantes(lista, { investimento: "acima_2000" });
    expect(res).toHaveLength(1);
    expect(res[0].nome_participante).toBe("José Santos");
  });

  it("filtra por quem convidou", () => {
    const res = filtrarParticipantes(lista, { convidou: "Carlos" });
    expect(res).toHaveLength(2);
  });

  it("filtra por acompanhante", () => {
    const comAcomp = filtrarParticipantes(lista, { acompanhante: "sim" });
    expect(comAcomp).toHaveLength(1);
    expect(comAcomp[0].nome_participante).toBe("Maria Silva");
  });

  it("filtra por busca textual (nome, telefone ou número da sorte)", () => {
    const porNome = filtrarParticipantes(lista, { busca: "jose" });
    expect(porNome).toHaveLength(1);

    const porTelefone = filtrarParticipantes(lista, { busca: "97777" });
    expect(porTelefone).toHaveLength(1);

    const porSorteio = filtrarParticipantes(lista, { busca: "0100" });
    expect(porSorteio).toHaveLength(1);
    expect(porSorteio[0].nome_participante).toBe("Maria Silva");
  });
});
