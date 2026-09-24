import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tenant: vi.fn(),
  from: vi.fn(),
  getUserById: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resolveSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("@/lib/tenant/get-resolved-empresa", () => ({ getResolvedTenant: mocks.tenant }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from, auth: { admin: { getUserById: mocks.getUserById } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut } }),
}));
vi.mock("@/lib/parceiros/indicador-app-session", () => ({ resolveIndicadorAppSession: mocks.resolveSession }));

const EMPRESA = "empresa-1";
const USUARIO = "usuario-1";
const AUTH = "auth-1";
const EMAIL_CONTATO = "cleusa@example.com";
const EMAIL_AUTH = "cpf-12345678901@parceiro.gauchinho.local";

function query(data: unknown) {
  const result = { data, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "ilike", "in"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ ...result, data: Array.isArray(data) ? data[0] ?? null : data }));
  builder.limit = vi.fn(async () => result);
  builder.then = (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenant.mockResolvedValue({ empresaId: EMPRESA });
  mocks.from.mockImplementation((table: string) => {
    if (table === "usuarios") return query({ id: USUARIO, auth_user_id: AUTH, ativo: true });
    if (table === "participantes_comerciais") return query([{ id: "participante-1", usuario_id: USUARIO, status: "ATIVO" }]);
    if (table === "empresa_usuarios") return query([{ id: "vinculo-1" }]);
    throw new Error(`Consulta inesperada: ${table}`);
  });
  mocks.getUserById.mockResolvedValue({ data: { user: { id: AUTH, email: EMAIL_AUTH } } });
  mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: AUTH } }, error: null });
  mocks.resolveSession.mockResolvedValue({ indicador: { id: "indicador-1" } });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe("login do app de indicação", () => {
  it("aceita e-mail de contato de conta com credencial técnica legada", async () => {
    const { loginIndicadorAction } = await import("./actions");
    const form = new FormData();
    form.set("identificador", EMAIL_CONTATO);
    form.set("senha", "senha-teste");
    await expect(loginIndicadorAction(form)).rejects.toThrow("REDIRECT:/app-indicador");
    expect(mocks.from).toHaveBeenCalledWith("empresa_usuarios");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL_AUTH, password: "senha-teste" });
    expect(mocks.resolveSession).toHaveBeenCalledWith(EMPRESA, USUARIO);
  });

  it("aceita CPF formatado e usa a identidade Auth vinculada", async () => {
    const { loginIndicadorAction } = await import("./actions");
    const form = new FormData();
    form.set("identificador", "123.456.789-01");
    form.set("senha", "senha-teste");
    await expect(loginIndicadorAction(form)).rejects.toThrow("REDIRECT:/app-indicador");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL_AUTH, password: "senha-teste" });
  });

  it("bloqueia acesso sem vínculo com a empresa do host", async () => {
    mocks.from.mockImplementation((table: string) => query(table === "empresa_usuarios" ? [] : table === "participantes_comerciais" ? [{ id: "p", status: "ATIVO" }] : { id: USUARIO, auth_user_id: AUTH, ativo: true }));
    const { loginIndicadorAction } = await import("./actions");
    const form = new FormData();
    form.set("identificador", EMAIL_CONTATO);
    form.set("senha", "senha-teste");
    await expect(loginIndicadorAction(form)).rejects.toThrow(/REDIRECT:.*inv%C3%A1lidos/);
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("encerra sessão se o indicador não estiver ativo", async () => {
    mocks.resolveSession.mockResolvedValue({ indicador: null });
    const { loginIndicadorAction } = await import("./actions");
    const form = new FormData();
    form.set("identificador", EMAIL_CONTATO);
    form.set("senha", "senha-teste");
    await expect(loginIndicadorAction(form)).rejects.toThrow(/REDIRECT:.*n%C3%A3o%20est%C3%A1%20ativo/);
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
