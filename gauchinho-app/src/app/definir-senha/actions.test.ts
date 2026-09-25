import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getUserById: vi.fn(), updateUserById: vi.fn(), rpc: vi.fn(), refreshSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser, refreshSession: mocks.refreshSession }, rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { getUserById: mocks.getUserById, updateUserById: mocks.updateUserById } } }),
}));

import { trocarSenhaPrimeiroAcesso } from "./actions";

describe("definição de senha", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
    mocks.getUserById.mockResolvedValue({ data: { user: { app_metadata: { role: "user", exige_troca_senha: true } } }, error: null });
    mocks.updateUserById.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.refreshSession.mockResolvedValue({ error: null });
  });

  it("atualiza senha e sinal de primeiro acesso em uma única operação", async () => {
    expect((await trocarSenhaPrimeiroAcesso("NovaSenha!2026")).ok).toBe(true);
    expect(mocks.updateUserById).toHaveBeenCalledOnce();
    expect(mocks.updateUserById).toHaveBeenCalledWith("auth-1", {
      password: "NovaSenha!2026",
      app_metadata: { role: "user", exige_troca_senha: false },
    });
  });

  it("não relata falha de senha depois de gravação bem sucedida quando convite legado falha", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "falha temporária" } });
    expect((await trocarSenhaPrimeiroAcesso("NovaSenha!2026")).ok).toBe(true);
  });

  it("retorna falha quando Auth rejeita a alteração", async () => {
    mocks.updateUserById.mockResolvedValue({ error: { message: "indisponível" } });
    expect((await trocarSenhaPrimeiroAcesso("NovaSenha!2026")).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
