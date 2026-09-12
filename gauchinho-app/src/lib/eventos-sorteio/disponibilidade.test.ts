import { describe, expect, it } from "vitest";
import { resolverStatusCheckinEvento, type EventoDisponibilidadeInput } from "./disponibilidade";
import { eventoLocalDateTimeToIso } from "./timezone";

describe("disponibilidade do check-in de eventos", () => {
  // Evento marcado para 16/09/2026 18:30 (Cuiabá)
  const eventoDataIso = eventoLocalDateTimeToIso("2026-09-16T18:30")!;

  const baseEvento: EventoDisponibilidadeInput = {
    ativo: true,
    checkin_interativo_ativo: true,
    data_evento: eventoDataIso,
    checkin_modo: "agendado",
    checkin_abertura_antecipada_minutos: 30,
  };

  it("Cenário A: evento futuro em modo agendado antes do horário de abertura (FECHADO / AGENDADO)", () => {
    // 16/09/2026 às 17:00 (Cuiabá) — antes de 18:00 (abertura 30 min antes de 18:30)
    const agoraIso = eventoLocalDateTimeToIso("2026-09-16T17:00")!;
    const agora = new Date(agoraIso);

    const res = resolverStatusCheckinEvento(baseEvento, agora);

    expect(res.status).toBe("agendado");
    expect(res.aberto).toBe(false);
    expect(res.horarioAberturaFormatado).toBe("18:00");
    expect(res.mensagemAmigavel).toContain("Este evento está confirmado para 16/09/2026 às 18:30");
    expect(res.mensagemAmigavel).toContain("O check-in será liberado a partir das 18:00");
  });

  it("Cenário B: evento com abertura 30 min antes e horário atual 18:10 (ABERTO)", () => {
    // 16/09/2026 às 18:10 (Cuiabá) — depois das 18:00
    const agoraIso = eventoLocalDateTimeToIso("2026-09-16T18:10")!;
    const agora = new Date(agoraIso);

    const res = resolverStatusCheckinEvento(baseEvento, agora);

    expect(res.status).toBe("aberto");
    expect(res.aberto).toBe(true);
    expect(res.horarioAberturaFormatado).toBe("18:00");
  });

  it("Cenário C: evento futuro quando o administrador seleciona ATIVAR AGORA (ATIVO MANUALMENTE)", () => {
    // 16/09/2026 às 10:00 (horas antes do evento)
    const agoraIso = eventoLocalDateTimeToIso("2026-09-16T10:00")!;
    const agora = new Date(agoraIso);

    const eventoAtivoAgora: EventoDisponibilidadeInput = {
      ...baseEvento,
      checkin_modo: "ativo_agora",
    };

    const res = resolverStatusCheckinEvento(eventoAtivoAgora, agora);

    expect(res.status).toBe("ativo_manual");
    expect(res.aberto).toBe(true);
    expect(res.mensagemAmigavel).toContain("liberado manualmente");
  });

  it("Cenário D: retorno ao modo agendado volta a respeitar o horário futuro", () => {
    const agoraIso = eventoLocalDateTimeToIso("2026-09-16T10:00")!;
    const agora = new Date(agoraIso);

    const eventoRestaurado: EventoDisponibilidadeInput = {
      ...baseEvento,
      checkin_modo: "agendado",
    };

    const res = resolverStatusCheckinEvento(eventoRestaurado, agora);

    expect(res.status).toBe("agendado");
    expect(res.aberto).toBe(false);
  });

  it("Cenário E: modo encerrado bloqueia o check-in", () => {
    const agoraIso = eventoLocalDateTimeToIso("2026-09-16T22:00")!;
    const agora = new Date(agoraIso);

    const eventoEncerrado: EventoDisponibilidadeInput = {
      ...baseEvento,
      checkin_modo: "encerrado",
    };

    const res = resolverStatusCheckinEvento(eventoEncerrado, agora);

    expect(res.status).toBe("encerrado");
    expect(res.aberto).toBe(false);
  });

  it("Cenário F: evento inativo ou sem check-in interativo", () => {
    const agora = new Date();
    const resInativo = resolverStatusCheckinEvento({ ...baseEvento, ativo: false }, agora);
    expect(resInativo.status).toBe("desativado");
    expect(resInativo.aberto).toBe(false);

    const resTradicional = resolverStatusCheckinEvento(
      { ...baseEvento, checkin_interativo_ativo: false },
      agora,
    );
    expect(resTradicional.status).toBe("desativado");
    expect(resTradicional.aberto).toBe(false);
  });
});
