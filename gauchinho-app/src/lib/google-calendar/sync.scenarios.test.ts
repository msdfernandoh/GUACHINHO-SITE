import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle, single: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

vi.mock("./config", () => ({
  isGoogleCalendarConfigured: () => true,
  isGmailAddress: (email: string) => /@gmail\.com$/i.test(email),
}));

const mockGetToken = vi.fn();
const mockClearToken = vi.fn();
vi.mock("./token-store", () => ({
  getGoogleRefreshToken: (id: string) => mockGetToken(id),
  clearGoogleRefreshToken: (id: string) => mockClearToken(id),
}));

const mockCreate = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDelete = vi.fn();
const mockRefresh = vi.fn();
vi.mock("./client", () => ({
  createGoogleCalendarEvent: (...args: unknown[]) => mockCreate(...args),
  updateGoogleCalendarEvent: (...args: unknown[]) => mockUpdateEvent(...args),
  deleteGoogleCalendarEvent: (...args: unknown[]) => mockDelete(...args),
  refreshGoogleAccessToken: (token: string) => mockRefresh(token),
}));

vi.mock("./log", () => ({
  logGoogleCalendar: vi.fn(),
  logGoogleCalendarError: vi.fn(),
}));

import { GoogleCalendarAuthError } from "./types";
import {
  pushCompromissoToGoogleCalendar,
  updateCompromissoOnGoogleCalendar,
  removeCompromissoFromGoogleCalendar,
} from "./sync";

const JOAO_ID = "consultor-joao";
const COMP_ID = "comp-1";

function mockCompromisso(overrides: Record<string, unknown> = {}) {
  return {
    id: COMP_ID,
    consultor_id: JOAO_ID,
    lead_id: null,
    titulo: "Visita",
    descricao: null,
    tipo: "Visita",
    data_inicio: "2026-07-21T13:00:00.000Z",
    data_fim: "2026-07-21T13:30:00.000Z",
    duracao_minutos: 30,
    local: null,
    status: "agendado",
    google_calendar_event_id: null,
    ...overrides,
  };
}

function mockConsultor() {
  return {
    id: JOAO_ID,
    nome: "João",
    email: "joao@gmail.com",
    google_agenda_sync: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockImplementation((table: string) => {
    if (table === "agenda_compromissos") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: mockCompromisso(), error: null }),
          }),
        }),
        update: mockUpdate,
      };
    }
    if (table === "usuarios") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: mockConsultor(), error: null }),
          }),
        }),
      };
    }
    return { select: mockSelect, update: mockUpdate };
  });
});

describe("pushCompromissoToGoogleCalendar", () => {
  it("cenário 1: usa token do consultor João e cria evento", async () => {
    mockGetToken.mockResolvedValue("refresh-joao");
    mockRefresh.mockResolvedValue("access-joao");
    mockCreate.mockResolvedValue("google-event-1");

    const result = await pushCompromissoToGoogleCalendar(COMP_ID);

    expect(mockGetToken).toHaveBeenCalledWith(JOAO_ID);
    expect(mockRefresh).toHaveBeenCalledWith("refresh-joao");
    expect(mockCreate).toHaveBeenCalledWith("access-joao", expect.any(Object));
    expect(result.synced).toBe(true);
    expect(result.eventId).toBe("google-event-1");
  });

  it("cenário 2: João sem refresh token — aviso e sem create", async () => {
    mockGetToken.mockResolvedValue(null);

    const result = await pushCompromissoToGoogleCalendar(COMP_ID);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.synced).toBe(false);
    expect(result.reason).toBe("consultor_not_connected");
    expect(result.userMessage).toContain("João ainda não conectou");
  });

  it("cenário 3: invalid_grant limpa token e pede reconexão", async () => {
    mockGetToken.mockResolvedValue("bad-refresh");
    mockRefresh.mockRejectedValue(new GoogleCalendarAuthError("invalid_grant", "revoked"));

    const result = await pushCompromissoToGoogleCalendar(COMP_ID);

    expect(mockClearToken).toHaveBeenCalledWith(JOAO_ID);
    expect(result.reason).toBe("requires_reconnect");
    expect(result.userMessage).toContain("precisa reconectar");
  });
});

describe("updateCompromissoOnGoogleCalendar", () => {
  it("cenário 4: atualiza evento existente sem recriar", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "agenda_compromissos") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: mockCompromisso({ google_calendar_event_id: "existing-id" }),
                  error: null,
                }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === "usuarios") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: mockConsultor(), error: null }),
            }),
          }),
        };
      }
      return { select: mockSelect, update: mockUpdate };
    });
    mockGetToken.mockResolvedValue("refresh-joao");
    mockRefresh.mockResolvedValue("access-joao");
    mockUpdateEvent.mockResolvedValue(undefined);

    const result = await updateCompromissoOnGoogleCalendar(COMP_ID);

    expect(mockUpdateEvent).toHaveBeenCalledWith("access-joao", "existing-id", expect.any(Object));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.synced).toBe(true);
    expect(result.eventId).toBe("existing-id");
  });
});

describe("removeCompromissoFromGoogleCalendar", () => {
  it("cenário 5: remove evento com token do consultor", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "agenda_compromissos") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: mockCompromisso({ google_calendar_event_id: "ev-del" }),
                  error: null,
                }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === "usuarios") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: mockConsultor(), error: null }),
            }),
          }),
        };
      }
      return { select: mockSelect, update: mockUpdate };
    });
    mockGetToken.mockResolvedValue("refresh-joao");
    mockRefresh.mockResolvedValue("access-joao");
    mockDelete.mockResolvedValue(undefined);

    const result = await removeCompromissoFromGoogleCalendar(COMP_ID);

    expect(mockDelete).toHaveBeenCalledWith("access-joao", "ev-del");
    expect(result.synced).toBe(true);
  });
});