import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(), patch: vi.fn(), remove: vi.fn(), refresh: vi.fn(), getToken: vi.fn(), clearToken: vi.fn(),
  row: {} as Record<string, unknown>, participants: [] as Array<Record<string, unknown>>,
  authorized: true, enabled: true, visible: true, saveError: false,
  writes: [] as Array<{ table: string; patch: unknown; filters: unknown[] }>,
}));
vi.mock("server-only", () => ({}));
function query(table: string) {
  const filters: unknown[] = [];
  let patch: unknown;
  const result = () => {
    if (patch) { m.writes.push({ table, patch, filters }); return { data: null, error: m.saveError ? { message: "save failed" } : null }; }
    const data = table === "agenda_compromissos" ? (m.visible ? m.row : null)
      : table === "agenda_compromisso_participantes" ? m.participants
      : table === "empresa_usuarios" ? { google_agenda_sync: m.enabled }
      : table === "usuarios" ? { id: "joao", nome: "João", email: "joao@gmail.com" } : null;
    return { data, error: null };
  };
  const q = {
    select: () => q, update: (value: unknown) => { patch = value; return q; },
    eq: (...args: unknown[]) => { filters.push(args); return q; },
    maybeSingle: async () => result(), single: async () => result(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: query, rpc: async () => ({ data: m.authorized, error: null }) }) }));
vi.mock("@/lib/tenant/context", () => ({ requireTenantPermission: async () => ({ empresaAtiva: { id: "empresa-a" } }) }));
vi.mock("./config", () => ({ isGoogleCalendarConfigured: () => true, isGmailAddress: () => true }));
vi.mock("./token-store", () => ({ getGoogleRefreshToken: m.getToken, clearGoogleRefreshToken: m.clearToken }));
vi.mock("./client", () => ({ createGoogleCalendarEvent: m.create, updateGoogleCalendarEvent: m.patch,
  deleteGoogleCalendarEvent: m.remove, refreshGoogleAccessToken: m.refresh,
  fetchGoogleAccountEmail: async () => "joao@gmail.com" }));
vi.mock("./log", () => ({ logGoogleCalendar: vi.fn(), logGoogleCalendarError: vi.fn() }));

import { pushCompromissoToGoogleCalendar, updateCompromissoOnGoogleCalendar, removeCompromissoFromGoogleCalendar } from "./sync";
import { GoogleCalendarAuthError } from "./types";

beforeEach(() => {
  vi.clearAllMocks();
  m.row = { id: "comp-1", empresa_id: "empresa-a", consultor_id: "joao", lead_id: null, titulo: "Visita", tipo: "Visita",
    data_inicio: "2026-09-16T19:00:00Z", data_fim: "2026-09-16T20:30:00Z", duracao_minutos: 90,
    status: "agendado", origem: "SISTEMA", dia_inteiro: false };
  m.participants = [{ usuario_id: "joao", google_calendar_event_id: null }];
  m.authorized = true; m.enabled = true; m.visible = true; m.saveError = false; m.writes = [];
  m.getToken.mockResolvedValue("refresh-joao"); m.refresh.mockResolvedValue("access-joao"); m.create.mockResolvedValue("google-1");
  m.patch.mockResolvedValue(undefined); m.remove.mockResolvedValue(undefined);
});

describe("Google agenda: escopo, idempotência e erros", () => {
  it("usa o token do responsável e preserva 15h de Cuiabá", async () => {
    const result = await pushCompromissoToGoogleCalendar("comp-1");
    expect(m.getToken).toHaveBeenCalledWith("joao");
    expect(m.create).toHaveBeenCalledWith("access-joao", expect.objectContaining({ dataInicioIso: "2026-09-16T19:00:00Z", eventId: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(result).toMatchObject({ synced: true, eventId: "google-1" });
    expect(m.writes.every((w) => w.filters.some((f) => JSON.stringify(f) === '["empresa_id","empresa-a"]'))).toBe(true);
  });
  it("avisa quando falta conexão", async () => {
    m.getToken.mockResolvedValue(null);
    expect((await pushCompromissoToGoogleCalendar("comp-1")).reason).toBe("consultor_not_connected");
    expect(m.create).not.toHaveBeenCalled();
  });
  it("invalid_grant limpa token e pede reconexão", async () => {
    m.refresh.mockRejectedValue(new GoogleCalendarAuthError("invalid_grant", "revoked"));
    expect((await pushCompromissoToGoogleCalendar("comp-1")).reason).toBe("requires_reconnect");
    expect(m.clearToken).toHaveBeenCalledWith("joao");
  });
  it("atualiza sem criar duplicata", async () => {
    m.participants = [{ usuario_id: "joao", google_calendar_event_id: "existing", google_conta_email: "joao@gmail.com" }];
    expect((await updateCompromissoOnGoogleCalendar("comp-1")).synced).toBe(true);
    expect(m.patch).toHaveBeenCalledWith("access-joao", "existing", expect.any(Object));
    expect(m.create).not.toHaveBeenCalled();
  });
  it("remove somente após cancelamento autorizado", async () => {
    m.row.status = "cancelado";
    m.participants = [{ usuario_id: "joao", google_calendar_event_id: "existing", google_conta_email: "joao@gmail.com" }];
    expect((await removeCompromissoFromGoogleCalendar("comp-1")).synced).toBe(true);
    expect(m.remove).toHaveBeenCalledWith("access-joao", "existing");
  });
  it("não toca Google sem permissão de operação", async () => {
    m.authorized = false;
    await removeCompromissoFromGoogleCalendar("comp-1"); await pushCompromissoToGoogleCalendar("comp-1");
    expect(m.getToken).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled();
  });
  it("não toca registro invisível pelo tenant/RLS", async () => {
    m.visible = false;
    await pushCompromissoToGoogleCalendar("comp-1"); expect(m.getToken).not.toHaveBeenCalled();
  });
  it("respeita desativação no vínculo da empresa", async () => {
    m.enabled = false;
    expect((await pushCompromissoToGoogleCalendar("comp-1")).synced).toBe(false);
    expect(m.getToken).not.toHaveBeenCalled();
  });
  it("não reexporta compromissos importados", async () => {
    m.row.origem = "GOOGLE";
    await pushCompromissoToGoogleCalendar("comp-1"); expect(m.create).not.toHaveBeenCalled();
  });
  it("mantém vínculo quando exclusão remota falha", async () => {
    m.row.status = "cancelado";
    m.participants = [{ usuario_id: "joao", google_calendar_event_id: "existing", google_conta_email: "joao@gmail.com" }];
    m.remove.mockRejectedValue(new Error("offline"));
    expect((await removeCompromissoFromGoogleCalendar("comp-1")).synced).toBe(false);
    expect(m.writes).toHaveLength(0);
  });
  it("não declara sucesso quando persistência falha", async () => {
    m.saveError = true;
    expect((await pushCompromissoToGoogleCalendar("comp-1")).reason).toBe("google_error");
  });
  it("não altera evento de uma conta Google anterior", async () => {
    m.participants = [{ usuario_id: "joao", google_calendar_event_id: "existing", google_conta_email: "outra@gmail.com" }];
    expect((await pushCompromissoToGoogleCalendar("comp-1")).synced).toBe(false);
    expect(m.patch).not.toHaveBeenCalled();
  });
});
