import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  allowed: vi.fn(), admin: vi.fn(), session: vi.fn(), update: vi.fn(), getIdentity: vi.fn(),
  from: vi.fn(), eq: vi.fn(), single: vi.fn(),
}));
vi.mock("@/lib/auth/is-superadmin", () => ({ isPlatformSuperadmin: mocks.allowed }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.session } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { gerarNovaSenhaPrincipalPlatformAction } from "./usuarios-actions";
const initial = { status: "IDLE", message: "" } as const;
const link = { usuario_id: "user-db", is_responsavel_principal: true, ativo: true, status: "ATIVO" };
const user = { id: "user-db", email: "principal@example.test", auth_user_id: "auth-distinto", ativo: true };
function form(confirm = true) {
  const f = new FormData();
  f.set("empresa_id", "empresa-a"); f.set("empresa_usuario_id", "vinculo-a");
  if (confirm) f.set("confirmar", "true");
  return f;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.allowed.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ data: { user: { id: "operator-auth" } }, error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: mocks.eq, single: mocks.single };
  mocks.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.single.mockResolvedValueOnce({ data: link }).mockResolvedValueOnce({ data: user });
  mocks.getIdentity.mockResolvedValue({ data: { user: { email: user.email, app_metadata: { preserved: true } } }, error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.admin.mockReturnValue({ from: mocks.from, auth: { admin: { getUserById: mocks.getIdentity, updateUserById: mocks.update } } });
});
describe("nova senha do responsável principal", () => {
  it("nega chamadas sem superadmin antes de abrir acesso privilegiado", async () => {
    mocks.allowed.mockResolvedValue(false);
    expect((await gerarNovaSenhaPrincipalPlatformAction(initial, form())).status).toBe("ERROR");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("exige confirmação explícita", async () => {
    expect((await gerarNovaSenhaPrincipalPlatformAction(initial, form(false))).status).toBe("ERROR");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each([{ ...link, is_responsavel_principal: false }, { ...link, ativo: false }, { ...link, status: "CONVIDADO" }, null])("rejeita alvo inelegível %j", async value => {
    mocks.single.mockReset().mockResolvedValueOnce({ data: value });
    expect((await gerarNovaSenhaPrincipalPlatformAction(initial, form())).status).toBe("ERROR");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("confere o vínculo com a empresa e usa auth_user_id, não usuario_id", async () => {
    const result = await gerarNovaSenhaPrincipalPlatformAction(initial, form());
    expect(result.status).toBe("SUCCESS");
    expect(mocks.eq).toHaveBeenCalledWith("empresa_id", "empresa-a");
    expect(mocks.getIdentity).toHaveBeenCalledWith("auth-distinto");
    const [id, update] = mocks.update.mock.calls[0];
    expect(id).toBe("auth-distinto");
    expect(update.password).toHaveLength(16);
    expect(update.password).toMatch(/[A-Z]/);
    expect(update.password).toMatch(/[a-z]/);
    expect(update.password).toMatch(/[2-9]/);
    expect(update.password).toMatch(/[!@#$%&*+\-_]/);
    expect(update.app_metadata).toMatchObject({ preserved: true, exige_troca_senha: true, senha_redefinida_por: "operator-auth" });
    expect(update).not.toHaveProperty("email_confirm");
    expect(result.data?.senhaTemporaria).toBe(update.password);
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["empresa_usuarios", "usuarios"]);
  });
  it("não redefine identidade com e-mail divergente", async () => {
    mocks.getIdentity.mockResolvedValue({ data: { user: { email: "outro@example.test" } } });
    expect((await gerarNovaSenhaPrincipalPlatformAction(initial, form())).status).toBe("ERROR");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("não retorna senha quando Auth falha", async () => {
    mocks.update.mockResolvedValue({ error: { message: "internal" } });
    const result = await gerarNovaSenhaPrincipalPlatformAction(initial, form());
    expect(result.status).toBe("ERROR");
    expect(result.data).toBeUndefined();
  });
});
