import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  adminFrom: vi.fn(),
  adminEq: vi.fn(),
  adminIlike: vi.fn(),
  adminSelect: vi.fn(),
  adminUpdate: vi.fn(),
  adminCreateUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => mocks.headers(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mocks.adminFrom,
    auth: {
      admin: {
        createUser: mocks.adminCreateUser,
      },
    },
  }),
}));

import { solicitarRecuperacaoSenhaAction } from "./actions";
import { SENHA_PADRAO_CADASTRO } from "@/lib/auth/permissions";

describe("solicitarRecuperacaoSenhaAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.headers.mockReturnValue(
      new Headers({
        host: "gauchinho.com.br",
        "x-forwarded-proto": "https",
      }),
    );
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.adminCreateUser.mockResolvedValue({
      data: { user: { id: "new-auth-id" } },
      error: null,
    });
  });

  it("rejeita e-mail em branco ou inválido", async () => {
    const f1 = new FormData();
    f1.set("email", "");
    const res1 = await solicitarRecuperacaoSenhaAction(null, f1);
    expect(res1.ok).toBe(false);
    expect(res1.message).toContain("endereço de e-mail válido");

    const f2 = new FormData();
    f2.set("email", "emailinvalido");
    const res2 = await solicitarRecuperacaoSenhaAction(null, f2);
    expect(res2.ok).toBe(false);
  });

  it("retorna mensagem amigável sem vazar existência de e-mail não cadastrado", async () => {
    mocks.adminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const form = new FormData();
    form.set("email", "inexistente@example.com");
    const res = await solicitarRecuperacaoSenhaAction(null, form);

    expect(res.ok).toBe(true);
    expect(res.message).toContain("Se o e-mail estiver cadastrado");
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("bloqueia solicitação para usuários inativos", async () => {
    mocks.adminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "u-1", email: "inativo@example.com", auth_user_id: "a-1", ativo: false },
            error: null,
          }),
        }),
      }),
    });

    const form = new FormData();
    form.set("email", "inativo@example.com");
    const res = await solicitarRecuperacaoSenhaAction(null, form);

    expect(res.ok).toBe(false);
    expect(res.message).toContain("desativada no sistema");
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("dispara resetPasswordForEmail com redirectTo dinâmico e tenant-aware para usuário ativo", async () => {
    mocks.adminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "u-1", email: "consultor@gauchinho.com.br", auth_user_id: "auth-123", ativo: true },
            error: null,
          }),
        }),
      }),
    });

    const form = new FormData();
    form.set("email", "consultor@gauchinho.com.br");
    const res = await solicitarRecuperacaoSenhaAction(null, form);

    expect(res.ok).toBe(true);
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "consultor@gauchinho.com.br",
      {
        redirectTo: "https://gauchinho.com.br/auth/confirm?next=/definir-senha",
      },
    );
  });

  it("provisiona auth_user com senha padrão e exige_troca_senha se usuário não possuía vínculo auth prévio", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mocks.adminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "u-legacy", email: "legado@gauchinho.com.br", auth_user_id: null, ativo: true },
            error: null,
          }),
        }),
      }),
      update: updateMock,
    });

    const form = new FormData();
    form.set("email", "legado@gauchinho.com.br");
    const res = await solicitarRecuperacaoSenhaAction(null, form);

    expect(res.ok).toBe(true);
    expect(mocks.adminCreateUser).toHaveBeenCalledWith({
      email: "legado@gauchinho.com.br",
      password: "midiapormidia@123",
      email_confirm: true,
      app_metadata: { exige_troca_senha: true },
    });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("garante que a senha inicial padrão é midiapormidia@123", () => {
    expect(SENHA_PADRAO_CADASTRO).toBe("midiapormidia@123");
  });
});
