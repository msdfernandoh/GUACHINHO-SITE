import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const signInWithPassword = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword } }),
}));

import { POST } from "./route";

function request(next = "/admin", password = "senha-de-teste") {
  return new NextRequest("https://raconsorriso.com.br/auth/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: "  usuario@example.com  ", password, next }),
  });
}

describe("POST /auth/login", () => {
  beforeEach(() => signInWithPassword.mockReset());

  it("encaminha a senha temporária para a troca obrigatória", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { app_metadata: { exige_troca_senha: true } } },
      error: null,
    });

    const response = await POST(request("/admin"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://raconsorriso.com.br/definir-senha?next=%2Fadmin");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "usuario@example.com",
      password: "senha-de-teste",
    });
  });

  it("recusa destino externo e informa falha sem expor a senha", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });

    const response = await POST(request("//outro-site.example/rota"));
    const redirect = new URL(response.headers.get("location")!);
    expect(response.status).toBe(303);
    expect(redirect.pathname).toBe("/login");
    expect(redirect.searchParams.get("next")).toBe("/admin");
    expect(redirect.searchParams.get("error")).toBe("E-mail ou senha inválidos.");
    expect(redirect.href).not.toContain("senha-de-teste");
  });
});
