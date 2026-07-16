import { describe, expect, it } from "vitest";
import {
  escolherParticipanteAleatorio,
  filtrarElegiveisSorteio,
  idsCuponsMesmoTelefone,
} from "./sorteio";

const base = [
  { id: "1", codigo: "GCH-0001", nome: "A", telefone: "1", status: "participando" as const, ganhador: false },
  { id: "2", codigo: "GCH-0002", nome: "B", telefone: "2", status: "participando" as const, ganhador: true },
  { id: "3", codigo: "GCH-0003", nome: "C", telefone: "3", status: "cancelado" as const, ganhador: false },
  { id: "4", codigo: "GCH-0004", nome: "D", telefone: "4", status: "participando" as const, ganhador: false },
];

describe("filtrarElegiveisSorteio", () => {
  it("mantém apenas participando e não ganhadores", () => {
    const elegiveis = filtrarElegiveisSorteio(base);
    expect(elegiveis.map((p) => p.id)).toEqual(["1", "4"]);
  });
});

describe("escolherParticipanteAleatorio", () => {
  it("não escolhe ganhador anterior", () => {
    const pick = escolherParticipanteAleatorio(base, new Set(), () => 0);
    expect(pick?.id).toBe("1");
  });

  it("exclui ids já sorteados na sessão", () => {
    const pick = escolherParticipanteAleatorio(base, new Set(["1"]), () => 0);
    expect(pick?.id).toBe("4");
  });

  it("retorna null se não houver elegíveis", () => {
    const onlyWinner = base.map((p) => ({ ...p, ganhador: true }));
    expect(escolherParticipanteAleatorio(onlyWinner)).toBeNull();
  });
});

describe("idsCuponsMesmoTelefone", () => {
  it("agrupa cupons pelo telefone normalizado", () => {
    const rows = [
      { id: "a", codigo: "GCH-0001", nome: "A", telefone: "(66) 99999-1111", status: "participando" as const, ganhador: false },
      { id: "b", codigo: "GCH-0002", nome: "A", telefone: "66999991111", status: "participando" as const, ganhador: false },
      { id: "c", codigo: "GCH-0003", nome: "B", telefone: "66999992222", status: "participando" as const, ganhador: false },
    ];
    expect(idsCuponsMesmoTelefone(rows, "66 99999-1111")).toEqual(["a", "b"]);
  });
});
