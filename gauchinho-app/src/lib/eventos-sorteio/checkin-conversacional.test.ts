import { describe, expect, it } from "vitest";
import {
  labelCapacidade,
  labelAvaliacaoEncontro,
  labelMomentoOportunidade,
  labelMoradia,
  labelVeiculo,
  OPCOES_AVALIACAO_ENCONTRO,
  OPCOES_CAPACIDADE_MENSAL,
  OPCOES_MOMENTO_OPORTUNIDADE,
  OPCOES_MORADIA,
  OPCOES_VEICULO,
  type QualificacaoRespostasPayload,
  validarQualificacaoRespostas,
} from "./checkin-conversacional";
import { formatCodigoParticipacao, proximoCodigoFromExisting } from "./codigo";

describe("checkin-conversacional labels e opções", () => {
  it("contém as 4 opções de veículos", () => {
    const ids = OPCOES_VEICULO.map((o) => o.id);
    expect(ids).toEqual(["carro", "moto", "carro_moto", "nenhum"]);
    expect(labelVeiculo("carro_moto")).toBe("Carro e moto");
  });

  it("contém as 4 opções de moradia", () => {
    const ids = OPCOES_MORADIA.map((o) => o.id);
    expect(ids).toEqual(["propria_quitada", "propria_financiada", "aluguel", "outra"]);
    expect(labelMoradia("aluguel")).toBe("Moro de aluguel");
  });

  it("contém as 5 opções de capacidade mensal", () => {
    const ids = OPCOES_CAPACIDADE_MENSAL.map((o) => o.id);
    expect(ids).toEqual(["ate_500", "500_1000", "1000_2000", "acima_2000", "entender_primeiro"]);
    expect(labelCapacidade("1000_2000")).toBe("R$ 1.000 a R$ 2.000");
  });

  it("contém as novas opções de avaliação e momento atual", () => {
    expect(OPCOES_AVALIACAO_ENCONTRO.map((o) => o.id)).toEqual([
      "gostei_bastante",
      "gostei_entender_melhor",
      "pode_melhorar",
    ]);
    expect(OPCOES_MOMENTO_OPORTUNIDADE.map((o) => o.id)).toEqual([
      "simulacao_agora",
      "atendimento_presencial",
      "retomar_ate_3_meses",
      "futuro_acima_3_meses",
      "sem_interesse",
    ]);
    expect(labelAvaliacaoEncontro("gostei_bastante")).toBe("Gostei bastante e fez sentido para mim");
    expect(labelMomentoOportunidade("atendimento_presencial")).toBe("Quero agendar um atendimento presencial para os próximos dias");
  });
});

describe("emissão de número da sorte e concorrência lógica", () => {
  it("gera sequência sem prefixo no formato 001, 002, 003...", () => {
    expect(formatCodigoParticipacao(1)).toBe("001");
    expect(formatCodigoParticipacao(27)).toBe("027");
    expect(formatCodigoParticipacao(184)).toBe("184");
  });

  it("incrementa corretamente evitando colisões", () => {
    const codigosExistentes = ["001", "002", "003"];
    const proximo = proximoCodigoFromExisting(codigosExistentes);
    expect(proximo).toBe("004");
  });

  it("simula concorrência serializada garantindo unicidade", () => {
    const codigos: string[] = [];
    // 50 participantes concorrentes recebem números únicos crescentes
    for (let i = 1; i <= 50; i++) {
      const proximo = proximoCodigoFromExisting(codigos);
      expect(codigos.includes(proximo)).toBe(false);
      codigos.push(proximo);
    }
    expect(codigos.length).toBe(50);
    expect(codigos[0]).toBe("001");
    expect(codigos[26]).toBe("027");
    expect(codigos[49]).toBe("050");
  });

  it("permite prefixos dinâmicos por marca (ex: RCN-001, GCH-001)", () => {
    const codigosRacon = ["RCN-001", "RCN-002"];
    expect(proximoCodigoFromExisting(codigosRacon, "RCN-")).toBe("RCN-003");
  });
});

describe("isolamento entre qualificação comercial e NPS", () => {
  it("qualificacao_respostas preserva estrutura independente", () => {
    const qual: QualificacaoRespostasPayload = {
      veiculo: "carro",
      moradia: "aluguel",
      capacidade_mensal: "1000_2000",
      avaliacao_encontro: "gostei_bastante",
      avaliacao_melhoria: null,
      momento_oportunidade: "simulacao_agora",
    };

    expect(qual.veiculo).toBe("carro");
    expect(qual.moradia).toBe("aluguel");
    expect(qual.capacidade_mensal).toBe("1000_2000");
    // Garante que não possui chaves de NPS
    expect("recomendacao_evento" in qual).toBe(false);
    expect("conteudo_apresentado" in qual).toBe(false);
  });

  it("exige comentário quando a avaliação indica que pode melhorar", () => {
    const incompleta = validarQualificacaoRespostas({
      veiculo: "carro",
      moradia: "aluguel",
      capacidade_mensal: "1000_2000",
      avaliacao_encontro: "pode_melhorar",
      avaliacao_melhoria: "",
      momento_oportunidade: "retomar_ate_3_meses",
    });
    expect(incompleta.ok).toBe(false);

    const completa = validarQualificacaoRespostas({
      veiculo: "carro",
      moradia: "aluguel",
      capacidade_mensal: "1000_2000",
      avaliacao_encontro: "pode_melhorar",
      avaliacao_melhoria: "Mais tempo para perguntas.",
      momento_oportunidade: "retomar_ate_3_meses",
    });
    expect(completa).toMatchObject({
      ok: true,
      value: { avaliacao_melhoria: "Mais tempo para perguntas." },
    });
  });
});
