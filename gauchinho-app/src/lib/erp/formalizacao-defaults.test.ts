import { describe, expect, it } from "vitest";
import {
  resolverModalidadeComissaoId,
  resolverParticipantePrincipalId,
  resolverPerfilPrincipalId,
  resolverModalidadeRegraId,
  programaComissaoCompativelComTipoBem,
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

describe("programaComissaoCompativelComTipoBem", () => {
  const imovel = { programa: { nome: "Racon Imóvel — Comissão V2" } };
  const veiculo = { programa: { nome: "Racon Veículo — Comissão" } };

  it("seleciona o programa de imóvel para grupos de imóvel", () => {
    expect(programaComissaoCompativelComTipoBem(imovel, null, "IMÓVEL")).toBe(true);
    expect(programaComissaoCompativelComTipoBem(veiculo, null, "IMÓVEL")).toBe(false);
  });

  it("seleciona o programa de veículo para grupos de veículo", () => {
    expect(programaComissaoCompativelComTipoBem(veiculo, null, "VEÍCULO")).toBe(true);
    expect(programaComissaoCompativelComTipoBem(imovel, null, "VEÍCULO")).toBe(false);
  });

  it("prioriza o vínculo canônico do tipo sobre o nome do programa", () => {
    const regra = {
      programa: {
        nome: "Nome legado sem indicação do bem",
        tipos: [{ tipo_administradora_id: "tipo-imovel", ativo: true }],
      },
    };
    expect(programaComissaoCompativelComTipoBem(regra, "tipo-imovel", "VEÍCULO")).toBe(true);
    expect(programaComissaoCompativelComTipoBem(regra, "tipo-veiculo", "IMÓVEL")).toBe(false);
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

  it("prefere a microfranquia quando o participante também possui perfil de consultor", () => {
    expect(resolverPerfilPrincipalId({
      participanteId: "eroni",
      vinculos: [
        { participante_id: "eroni", perfil_id: "socio", papel_tipo: "CONSULTOR" },
        { participante_id: "eroni", perfil_id: "microfranquia", papel_tipo: "MICROFRANQUIA" },
      ],
    })).toBe("microfranquia");
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
