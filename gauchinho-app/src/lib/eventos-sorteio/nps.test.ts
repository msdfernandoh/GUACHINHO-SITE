import { describe, expect, it } from "vitest";
import {
  parseNpsConfig,
  resolverPerguntasNpsPublicas,
  validarRespostasNps,
  NPS_PERGUNTAS_FIXAS,
} from "./nps";

describe("resolverPerguntasNpsPublicas", () => {
  it("inclui todas as fixas por padrão", () => {
    const perguntas = resolverPerguntasNpsPublicas({});
    expect(perguntas.filter((p) => p.fixa)).toHaveLength(NPS_PERGUNTAS_FIXAS.length);
  });

  it("remove perguntas desativadas", () => {
    const perguntas = resolverPerguntasNpsPublicas({ desativadas: ["ambiente", "alimentacao"] });
    expect(perguntas.some((p) => p.chave === "ambiente")).toBe(false);
    expect(perguntas.some((p) => p.chave === "alimentacao")).toBe(false);
    expect(perguntas.some((p) => p.chave === "recomendacao_evento")).toBe(true);
  });

  it("inclui custom ativas", () => {
    const perguntas = resolverPerguntasNpsPublicas({
      custom: [
        { id: "a1", titulo: "Organização", tipo: "escala_0_10", ativa: true },
        { id: "a2", titulo: "Off", tipo: "texto", ativa: false },
      ],
    });
    expect(perguntas.some((p) => p.chave === "custom_a1")).toBe(true);
    expect(perguntas.some((p) => p.chave === "custom_a2")).toBe(false);
  });
});

describe("validarRespostasNps", () => {
  it("exige escala obrigatória", () => {
    const perguntas = resolverPerguntasNpsPublicas({ desativadas: NPS_PERGUNTAS_FIXAS.map((p) => p.chave).filter((k) => k !== "recomendacao_evento") });
    const res = validarRespostasNps(perguntas, {});
    expect(res.ok).toBe(false);
  });

  it("aceita respostas válidas", () => {
    const perguntas = resolverPerguntasNpsPublicas({
      desativadas: ["alimentacao", "comentario", "conteudo_apresentado", "clareza_temas", "ambiente", "duracao_apresentacao"],
    });
    const res = validarRespostasNps(perguntas, {
      recomendacao_evento: 9,
      contato_diagnostico: "sim",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.clean.recomendacao_evento).toBe(9);
      expect(res.clean.contato_diagnostico).toBe(true);
    }
  });
});

describe("parseNpsConfig", () => {
  it("ignora custom inválida", () => {
    const cfg = parseNpsConfig({ desativadas: ["ambiente"], custom: [{ id: "x" }] });
    expect(cfg.desativadas).toEqual(["ambiente"]);
    expect(cfg.custom).toEqual([]);
  });
});
