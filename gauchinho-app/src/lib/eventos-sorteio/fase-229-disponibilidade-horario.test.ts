import { describe, expect, it } from "vitest";
import {
  EVENTO_TIME_ZONE,
  eventoLocalDateTimeToIso,
  eventoIsoToDatetimeLocal,
  formatarDataHoraEvento,
  formatarHoraEvento,
  formatarDataEvento,
} from "./timezone";
import {
  resolverStatusCheckinEvento,
  type EventoDisponibilidadeInput,
} from "./disponibilidade";
import { DEFAULTS_SORTEIO } from "./types";

describe("Fase 229 — Auditoria e Validação Completa de Horário e Disponibilidade", () => {
  describe("1. Fuso Horário Operacional (America/Cuiaba) & Idempotência de Salvamento", () => {
    it("utiliza America/Cuiaba como timezone oficial", () => {
      expect(EVENTO_TIME_ZONE).toBe("America/Cuiaba");
    });

    const quatroHorariosObrigatorios = [
      { input: "2026-09-16T18:30", expectedDisplay: "16/09/2026 às 18:30", expectedUtc: "2026-09-16T22:30:00.000Z" },
      { input: "2026-09-16T08:00", expectedDisplay: "16/09/2026 às 08:00", expectedUtc: "2026-09-16T12:00:00.000Z" },
      { input: "2026-09-16T23:30", expectedDisplay: "16/09/2026 às 23:30", expectedUtc: "2026-09-17T03:30:00.000Z" },
      { input: "2027-01-01T00:15", expectedDisplay: "01/01/2027 às 00:15", expectedUtc: "2027-01-01T04:15:00.000Z" },
    ];

    for (const tc of quatroHorariosObrigatorios) {
      it(`preserva estritamente ${tc.input} no fluxo: digitar -> salvar -> ler banco -> reabrir`, () => {
        // 1. Digitar no datetime-local
        const valorDigitado = tc.input;

        // 2. Server Action converte para salvar no banco (timestamptz)
        const valorSalvoNoBanco = eventoLocalDateTimeToIso(valorDigitado);
        expect(valorSalvoNoBanco).toBe(tc.expectedUtc);

        // 3. Reabrir formulário no admin (carregando valor do banco para o datetime-local)
        const valorReabertoNaUI = eventoIsoToDatetimeLocal(valorSalvoNoBanco);
        expect(valorReabertoNaUI).toBe(valorDigitado);

        // 4. Formatação de visualização em tela pública
        const valorFormatado = formatarDataHoraEvento(valorSalvoNoBanco);
        expect(valorFormatado).toBe(tc.expectedDisplay);
      });

      it(`garante idempotência total no duplo salvamento de ${tc.input} (sem deslocamento de horas)`, () => {
        // 1º Salvamento
        const iso1 = eventoLocalDateTimeToIso(tc.input);
        const reaberto1 = eventoIsoToDatetimeLocal(iso1);

        // 2º Salvamento (usuário editou outro campo e salvou novamente sem tocar na data)
        const iso2 = eventoLocalDateTimeToIso(reaberto1);
        const reaberto2 = eventoIsoToDatetimeLocal(iso2);

        // 3º Salvamento consecutivo
        const iso3 = eventoLocalDateTimeToIso(reaberto2);
        const reaberto3 = eventoIsoToDatetimeLocal(iso3);

        expect(iso2).toBe(iso1);
        expect(reaberto2).toBe(tc.input);
        expect(iso3).toBe(iso1);
        expect(reaberto3).toBe(tc.input);
      });
    }

    it("trata valores nulos, vazios e inválidos de forma defensiva", () => {
      expect(eventoLocalDateTimeToIso("")).toBeNull();
      expect(eventoLocalDateTimeToIso(null)).toBeNull();
      expect(eventoLocalDateTimeToIso(undefined)).toBeNull();

      expect(eventoIsoToDatetimeLocal("")).toBe("");
      expect(eventoIsoToDatetimeLocal(null)).toBe("");
      expect(eventoIsoToDatetimeLocal(undefined)).toBe("");

      expect(formatarDataHoraEvento(null)).toBe("—");
      expect(formatarHoraEvento(null)).toBe("—");
      expect(formatarDataEvento(null)).toBe("—");
    });
  });

  describe("2. Regras de Disponibilidade do Check-in (resolverStatusCheckinEvento)", () => {
    // Evento marcado para 16/09/2026 às 18:30 (Cuiabá)
    const dataEventoIso = eventoLocalDateTimeToIso("2026-09-16T18:30")!;

    const eventoBase: EventoDisponibilidadeInput = {
      ativo: true,
      checkin_interativo_ativo: true,
      data_evento: dataEventoIso,
      checkin_modo: "agendado",
      checkin_abertura_antecipada_minutos: 30,
    };

    it("Cenário A: evento futuro em modo agendado antes do horário de abertura -> FECHADO / AGENDADO", () => {
      // Data de referência: 16/09/2026 às 17:00 (Cuiabá) — 1 hora antes da abertura
      const agoraIso = eventoLocalDateTimeToIso("2026-09-16T17:00")!;
      const agora = new Date(agoraIso);

      const status = resolverStatusCheckinEvento(eventoBase, agora);

      expect(status.status).toBe("agendado");
      expect(status.aberto).toBe(false);
      expect(status.horarioAberturaFormatado).toBe("18:00");
      expect(status.horarioEventoFormatado).toBe("16/09/2026 às 18:30");
      expect(status.mensagemAmigavel).toContain("Este evento está confirmado para 16/09/2026 às 18:30");
      expect(status.mensagemAmigavel).toContain("O check-in será liberado a partir das 18:00");
    });

    it("Cenário B: evento hoje 18:30 com abertura 30 min antes e hora atual 18:10 -> ABERTO", () => {
      // Data de referência: 16/09/2026 às 18:10 (Cuiabá) — dentro da janela de abertura
      const agoraIso = eventoLocalDateTimeToIso("2026-09-16T18:10")!;
      const agora = new Date(agoraIso);

      const status = resolverStatusCheckinEvento(eventoBase, agora);

      expect(status.status).toBe("aberto");
      expect(status.aberto).toBe(true);
      expect(status.horarioAberturaFormatado).toBe("18:00");
      expect(status.mensagemAmigavel).toBe("Check-in aberto.");
    });

    it("Cenário C: evento futuro quando o administrador seleciona ATIVAR AGORA -> ABERTO MANUALMENTE", () => {
      // Data de referência: 16/09/2026 às 10:00 (Cuiabá) — muito antes do evento
      const agoraIso = eventoLocalDateTimeToIso("2026-09-16T10:00")!;
      const agora = new Date(agoraIso);

      const eventoAtivoManual: EventoDisponibilidadeInput = {
        ...eventoBase,
        checkin_modo: "ativo_agora",
      };

      const status = resolverStatusCheckinEvento(eventoAtivoManual, agora);

      expect(status.status).toBe("ativo_manual");
      expect(status.aberto).toBe(true);
      expect(status.mensagemAmigavel).toContain("liberado manualmente");
    });

    it("Cenário D: administrador clica VOLTAR AO AGENDAMENTO -> AGENDADO novamente sem redigitar data", () => {
      const agoraIso = eventoLocalDateTimeToIso("2026-09-16T10:00")!;
      const agora = new Date(agoraIso);

      // Restaura para agendado
      const eventoRestaurado: EventoDisponibilidadeInput = {
        ...eventoBase,
        checkin_modo: "agendado",
      };

      const status = resolverStatusCheckinEvento(eventoRestaurado, agora);

      expect(status.status).toBe("agendado");
      expect(status.aberto).toBe(false);
      expect(status.horarioEventoFormatado).toBe("16/09/2026 às 18:30");
      expect(status.horarioAberturaFormatado).toBe("18:00");
    });

    it("Cenário E: evento em modo ENCERRADO -> FECHADO com mensagem de encerramento", () => {
      const agoraIso = eventoLocalDateTimeToIso("2026-09-16T22:00")!;
      const agora = new Date(agoraIso);

      const eventoEncerrado: EventoDisponibilidadeInput = {
        ...eventoBase,
        checkin_modo: "encerrado",
      };

      const status = resolverStatusCheckinEvento(eventoEncerrado, agora);

      expect(status.status).toBe("encerrado");
      expect(status.aberto).toBe(false);
      expect(status.mensagemAmigavel).toContain("já foi encerrado");
    });

    it("Cenário F: evento sem data definida permanece ABERTO por padrão", () => {
      const eventoSemData: EventoDisponibilidadeInput = {
        ativo: true,
        checkin_interativo_ativo: true,
        data_evento: null,
        checkin_modo: "agendado",
      };

      const status = resolverStatusCheckinEvento(eventoSemData);
      expect(status.status).toBe("aberto");
      expect(status.aberto).toBe(true);
    });

    it("Cenário G: evento legado (checkin_interativo_ativo = false) -> DESATIVADO", () => {
      const eventoLegado: EventoDisponibilidadeInput = {
        ...eventoBase,
        checkin_interativo_ativo: false,
      };

      const status = resolverStatusCheckinEvento(eventoLegado);
      expect(status.status).toBe("desativado");
      expect(status.aberto).toBe(false);
    });

    it("Cenário H: evento inativo (ativo = false) -> DESATIVADO", () => {
      const eventoInativo: EventoDisponibilidadeInput = {
        ...eventoBase,
        ativo: false,
      };

      const status = resolverStatusCheckinEvento(eventoInativo);
      expect(status.status).toBe("desativado");
      expect(status.aberto).toBe(false);
    });

    it("Cenário I: antecedência personalizada (ex: 60 minutos)", () => {
      const evento60Min: EventoDisponibilidadeInput = {
        ...eventoBase,
        checkin_abertura_antecipada_minutos: 60,
      };

      // 17:15 Cuiabá — 1 hora e 15 min antes das 18:30 (ainda fechado)
      const agoraFechado = new Date(eventoLocalDateTimeToIso("2026-09-16T17:15")!);
      const stFechado = resolverStatusCheckinEvento(evento60Min, agoraFechado);
      expect(stFechado.status).toBe("agendado");
      expect(stFechado.aberto).toBe(false);
      expect(stFechado.horarioAberturaFormatado).toBe("17:30");

      // 17:45 Cuiabá — 45 min antes das 18:30 (já aberto)
      const agoraAberto = new Date(eventoLocalDateTimeToIso("2026-09-16T17:45")!);
      const stAberto = resolverStatusCheckinEvento(evento60Min, agoraAberto);
      expect(stAberto.status).toBe("aberto");
      expect(stAberto.aberto).toBe(true);
    });

    it("Cenário J: virada de ano/dia (01/01/2027 00:15 com 30 min de antecedência -> abre em 31/12/2026 23:45)", () => {
      const eventoViradaIso = eventoLocalDateTimeToIso("2027-01-01T00:15")!;
      const eventoVirada: EventoDisponibilidadeInput = {
        ativo: true,
        checkin_interativo_ativo: true,
        data_evento: eventoViradaIso,
        checkin_modo: "agendado",
        checkin_abertura_antecipada_minutos: 30,
      };

      // 1. Antes da abertura: 31/12/2026 às 23:40 (Cuiabá) -> Fechado / Agendado
      const antesAbertura = new Date(eventoLocalDateTimeToIso("2026-12-31T23:40")!);
      const stFechado = resolverStatusCheckinEvento(eventoVirada, antesAbertura);
      expect(stFechado.status).toBe("agendado");
      expect(stFechado.aberto).toBe(false);
      expect(stFechado.horarioAberturaFormatado).toBe("23:45");
      expect(stFechado.horarioEventoFormatado).toBe("01/01/2027 às 00:15");
      expect(stFechado.mensagemAmigavel).toContain("Este evento está confirmado para 01/01/2027 às 00:15");
      expect(stFechado.mensagemAmigavel).toContain("a partir das 23:45");

      // 2. No momento da abertura: 31/12/2026 às 23:45 (Cuiabá) -> Aberto
      const noMomento = new Date(eventoLocalDateTimeToIso("2026-12-31T23:45")!);
      const stNoMomento = resolverStatusCheckinEvento(eventoVirada, noMomento);
      expect(stNoMomento.status).toBe("aberto");
      expect(stNoMomento.aberto).toBe(true);

      // 3. Durante o evento: 01/01/2027 às 00:10 (Cuiabá) -> Aberto
      const duranteEvento = new Date(eventoLocalDateTimeToIso("2027-01-01T00:10")!);
      const stDurante = resolverStatusCheckinEvento(eventoVirada, duranteEvento);
      expect(stDurante.status).toBe("aberto");
      expect(stDurante.aberto).toBe(true);
    });
  });

  describe("3. Resiliência: Evento Interativo sem eventos_sorteios (Fallback DEFAULTS_SORTEIO)", () => {
    it("possui defaults oficiais de título, descrição e agradecimento definidos", () => {
      expect(DEFAULTS_SORTEIO.titulo).toBeTruthy();
      expect(DEFAULTS_SORTEIO.descricao).toBeTruthy();
      expect(DEFAULTS_SORTEIO.texto_agradecimento).toBeTruthy();
    });
  });
});
