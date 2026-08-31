import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./sync", () => ({ getAccessTokenForConsultor: vi.fn() }));
import { eventBody, listGoogleCalendarEvents, createGoogleCalendarEvent } from "./client";
import { normalizeGoogleEvent } from "./pull-sync";

afterEach(() => vi.unstubAllGlobals());
const input = { titulo: "Inauguração", dataInicioIso: "2026-09-16T19:00:00Z", dataFimIso: "2026-09-16T20:30:00Z", compromissoId: "c1" };
describe("contrato Google", () => {
  it("envia 15h em Cuiabá, sem redefinir para 8h", () => {
    expect(eventBody(input).start).toMatchObject({ dateTime: "2026-09-16T19:00:00Z", timeZone: "America/Cuiaba" });
  });
  it("dia inteiro usa datas civis e término exclusivo, inclusive vários dias", () => {
    const body = eventBody({ ...input, diaInteiro: true, dataInicioIso: "2026-09-16T04:00:00Z", dataFimIso: "2026-09-19T04:00:00Z" });
    expect(body.start).toEqual({ date: "2026-09-16" });
    expect(body.end).toEqual({ date: "2026-09-19" });
  });
  it("importa duração de vários dias sem truncar", () => {
    expect(normalizeGoogleEvent({ id: "g1", start: { date: "2026-09-16" }, end: { date: "2026-09-19" } }))
      .toMatchObject({ inicio: "2026-09-16T04:00:00.000Z", fim: "2026-09-19T04:00:00.000Z", diaInteiro: true });
  });
  it("preserva offset do evento importado", () => {
    expect(normalizeGoogleEvent({ id: "g1", start: { dateTime: "2026-09-16T15:00:00-04:00" }, end: { dateTime: "2026-09-16T16:30:00-04:00" } }))
      .toMatchObject({ inicio: "2026-09-16T19:00:00.000Z", fim: "2026-09-16T20:30:00.000Z" });
  });
  it("não envia detalhes privados ao importador SQL", () => {
    const event = normalizeGoogleEvent({ id: "private", visibility: "private", summary: "Segredo", description: "Privado" });
    expect(event).toMatchObject({ privado: true }); expect(event).not.toHaveProperty("titulo"); expect(event).not.toHaveProperty("descricao");
  });
  it("ignora eco de evento do sistema", () => {
    expect(normalizeGoogleEvent({ id: "echo", extendedProperties: { private: { gauchinhoCompromissoId: "c1" } } })).toBeNull();
  });
  it("processa cancelamento sem horário", () => {
    expect(normalizeGoogleEvent({ id: "g1", status: "cancelled" })).toMatchObject({ id: "g1", status: "cancelled" });
  });
  it("pagina mesmo quando a página intermediária está vazia", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ items: [], nextPageToken: "p2" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "g2" }] })));
    vi.stubGlobal("fetch", fetch);
    expect((await listGoogleCalendarEvents("token")).events).toEqual([{ id: "g2" }]);
    expect(fetch.mock.calls[1][0]).toContain("pageToken=p2");
  });
  it("usa syncToken incremental sem misturar filtros de data", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: "g2", status: "cancelled" }], nextSyncToken: "next" })));
    vi.stubGlobal("fetch", fetch); const result = await listGoogleCalendarEvents("token", "previous");
    const url = String(fetch.mock.calls[0][0]); expect(url).toContain("syncToken=previous"); expect(url).not.toContain("timeMin");
    expect(result).toMatchObject({ nextSyncToken: "next", tokenExpired: false });
  });
  it("token expirado refaz a janela sem apagar histórico", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 410 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], nextSyncToken: "fresh" })));
    vi.stubGlobal("fetch", fetch); const result = await listGoogleCalendarEvents("token", "expired");
    expect(result).toMatchObject({ nextSyncToken: "fresh", tokenExpired: true });
    expect(String(fetch.mock.calls[1][0])).toContain("timeMin=");
  });
  it("falha de paginação não devolve sucesso parcial", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "g1" }], nextPageToken: "p2" })))
      .mockResolvedValueOnce(new Response("{}", { status: 503 })));
    await expect(listGoogleCalendarEvents("token")).rejects.toThrow("Falha ao consultar");
  });
  it("retry usa ID determinístico e atualiza após 409", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 409 })).mockResolvedValueOnce(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    expect(await createGoogleCalendarEvent("token", { ...input, eventId: "abc123" })).toBe("abc123");
    expect(fetch.mock.calls[1][1].method).toBe("PATCH");
  });
});
