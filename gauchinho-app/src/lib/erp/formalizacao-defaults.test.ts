import { describe, expect, it } from "vitest";
import {
  resolverModalidadeComissaoId,
  resolverParticipantePrincipalId,
  resolverPerfilPrincipalId,
  resolverModalidadeRegraId,
} from "./formalizacao-defaults";

describe("defaults canônicos da formalização", () => {
  it("converte o usuario da proposta no participante comercial do mesmo vínculo", () => {
    expect(resolverParticipantePrincipalId({
      consultorUsuarioId: "usuario-1",
      participantes: [
        { id: "participante-1", usuario_id: "usuario-1" },
        { id: "participante-2", usuario_id: "usuario-2" },
      ],
    })).toBe("participante-1");
  });

  it("seleciona automaticamente somente o único perfil de consultor", () => {
    expect(resolverPerfilPrincipalId({
      participanteId: "participante-1",
      vinculos: [
        { participante_id: "participante-1", perfil_id: "perfil-consultor", papel_tipo: "CONSULTOR" },
        { participante_id: "participante-1", perfil_id: "perfil-gestor", papel_tipo: "GESTOR" },
      ],
    })).toBe("perfil-consultor");
  });

  it("traduz a parcela reduzida da proposta para a modalidade canônica", () => {
    expect(resolverModalidadeComissaoId({
      modalidades: [
        { id: "integral", codigo: "INTEGRAL" },
        { id: "reduzida", codigo: "REDUZIDA_60_99" },
      ],
      dadosSimulacao: {
        selecoes: [{ config: { modalidadeParcela: "reduzida", percentualParcelaReduzida: 70 } }],
      },
    })).toBe("reduzida");
  });
});

describe("resolverModalidadeRegraId", () => {
  const modalidades = [
    { id: "sem-regra", isCadastradaNoBanco: false, percentualReferencia: 0 },
    { id: "integral", isCadastradaNoBanco: true, percentualReferencia: 3.5 },
    { id: "reduzida", isCadastradaNoBanco: true, percentualReferencia: 3.5 },
  ];

  it("seleciona automaticamente a modalidade válida preservada na proposta", () => {
    expect(resolverModalidadeRegraId({ modalidadePropostaId: "reduzida", modalidades })).toBe("reduzida");
  });

  it("não escolhe percentual arbitrário quando há mais de uma opção homologada", () => {
    expect(resolverModalidadeRegraId({ modalidadeAtualId: "sem-regra", modalidades })).toBe("");
  });

  it("fixa automaticamente quando existe somente uma opção homologada", () => {
    expect(resolverModalidadeRegraId({
      modalidades: [{ id: "unica", isCadastradaNoBanco: true, percentualReferencia: 4 }],
    })).toBe("unica");
  });
});
