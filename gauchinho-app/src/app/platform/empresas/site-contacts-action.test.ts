import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ allowed: vi.fn(), create: vi.fn(), update: vi.fn(), eq: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/auth/is-superadmin", () => ({ isPlatformSuperadmin: mocks.allowed }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.create }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant/tenant-host-cache", () => ({ invalidateTenantHostCache: vi.fn() }));
import { salvarContatosSiteAction } from "./site-contacts-action";
const empresa = "12345678-1234-4234-8234-123456789abc";
const form = () => {
  const data = new FormData();
  data.set("empresa_id", empresa);
  data.set("telefone", "0800 123 4567");
  data.set("whatsapp", "66999998888");
  return data;
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.allowed.mockResolvedValue(true);
  mocks.single.mockResolvedValue({ data: { id: "branding" }, error: null });
  mocks.eq.mockReturnValue({ select: () => ({ maybeSingle: mocks.single }) });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.create.mockResolvedValue({ from: () => ({ update: mocks.update }) });
});
describe("edição isolada dos contatos públicos", () => {
  it("nega usuários sem permissão antes de acessar o banco", async () => {
    mocks.allowed.mockResolvedValue(false);
    expect((await salvarContatosSiteAction({ ok: false, message: "" }, form())).ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("atualiza somente os contatos da empresa explícita", async () => {
    expect((await salvarContatosSiteAction({ ok: false, message: "" }, form())).ok).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ telefone: "0800 123 4567", whatsapp: "66999998888" });
    expect(mocks.eq).toHaveBeenCalledWith("empresa_id", empresa);
  });
  it("não trunca números inválidos nem envia atualização", async () => {
    const data = form(); data.set("telefone", "6".repeat(33));
    expect((await salvarContatosSiteAction({ ok: false, message: "" }, data)).ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("não anuncia sucesso quando não encontra o branding", async () => {
    mocks.single.mockResolvedValue({ data: null, error: null });
    expect((await salvarContatosSiteAction({ ok: false, message: "" }, form())).ok).toBe(false);
  });
});
