import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rota: vi.fn(), permissao: vi.fn(), painel: vi.fn(), rpc: vi.fn(), from: vi.fn(), anterior: null as null | Record<string, unknown>, destinos: [{ id: "pessoal" }], consultas: [] as string[] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/erp/erp-acesso-server", () => ({ requireErpRouteAccess: m.rota }));
vi.mock("@/lib/tenant/context", () => ({ requireTenantPermission: m.permissao }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: m.from, rpc: m.rpc }) }));
vi.mock("@/app/erp/fechamento-socios/actions", () => ({ carregarPainelFechamento: m.painel }));
import { efetivarTransferenciaSocio } from "@/app/erp/fechamento-socios/transferencia-actions";
const transferencia = { valor: 300, conta_origem_id: "pj", conta_destino_id: "pessoal", comprovante_referencia: "PIX-123456" };
const painel = () => ({ inicio: "2026-10-01", hoje: "2026-10-20", bancoEmpresa: { id: "pj", saldoSistema: 2000 }, bloqueios: [], despesasPagas: 400, margemConsultores: 0, receitasEventos: 0, reservaImpostos: 200,
  socios: [{ id: "s", nome: "Fernando", percentual: 50, comissaoGuardada: 1000, adiantamentoPessoal: 0, saldoAnterior: 0, transferenciasRealizadas: 0 }, { id: "e", nome: "Eroni", percentual: 50, comissaoGuardada: 500, adiantamentoPessoal: 0, saldoAnterior: 0, transferenciasRealizadas: 0 }] });
function pedido() { const f = new FormData(); Object.entries({ socio_id: "s", inicio: "2026-10-01", transferencias_base: "0", valor: "300", comprovante: "PIX-123456", confirmo_transferencia: "sim" }).forEach(([k,v]) => f.set(k,v)); return f; }
beforeEach(() => {
  vi.clearAllMocks(); m.anterior = null; m.destinos = [{ id: "pessoal" }]; m.consultas = [];
  m.rota.mockResolvedValue({ empresaAtiva: { id: "tenant" } }); m.permissao.mockResolvedValue({ empresaAtiva: { id: "tenant" } });
  m.painel.mockResolvedValue(painel()); m.rpc.mockResolvedValue({ data: { transferencia }, error: null });
  m.from.mockImplementation((t: string) => {
    m.consultas.push(t);
    const resultado = () => ({ data: t === "empresa_socios" ? { id: "s", usuario_id: "u", nome: "Fernando" } : t === "participantes_comerciais" ? [{ id: "pc" }] : t === "financeiro_contas_bancarias" ? m.destinos : m.anterior, error: null });
    const q = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), single: vi.fn(async () => resultado()), maybeSingle: vi.fn(async () => resultado()), then: (resolve: (value: unknown) => unknown) => Promise.resolve(resultado()).then(resolve) };
    q.select.mockReturnValue(q); q.eq.mockReturnValue(q); q.in.mockReturnValue(q); return q;
  });
});
describe("efetivar retirada individual", () => {
  it("registra débito e crédito pela RPC atômica, sem pagar comissão ou lacrar", async () => {
    await expect(efetivarTransferenciaSocio(pedido())).resolves.toEqual({ ok: true, saldoSistema: 2000 });
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("rpc_transferir_entre_contas", expect.objectContaining({ p_empresa_id: "tenant", p_conta_origem_id: "pj", p_conta_destino_id: "pessoal", p_valor: 300, p_comprovante: "PIX-123456", p_data: "2026-10-20", p_idempotency_key: "retirada-socio:s:2026-10-01:0" }));
  });
  it("recusa empresa divergente antes de acessar dados", async () => {
    m.permissao.mockResolvedValue({ empresaAtiva: { id: "outra" } });
    await expect(efetivarTransferenciaSocio(pedido())).resolves.toEqual({ ok: false, mensagem: expect.stringContaining("Empresa ativa divergente") }); expect(m.from).not.toHaveBeenCalled();
  });
  it.each(["0", "-1", "NaN", "1.234", "Infinity"])("rejeita valor inválido %s", async (valor) => {
    const f = pedido(); f.set("valor", valor); await expect(efetivarTransferenciaSocio(f)).resolves.toEqual({ ok: false, mensagem: expect.stringContaining("valor positivo") }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("exige confirmação de transferência real", async () => {
    const f = pedido(); f.delete("confirmo_transferencia"); await expect(efetivarTransferenciaSocio(f)).resolves.toEqual({ ok: false, mensagem: expect.stringContaining("confirme") }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejeita retirada acima do crédito", async () => {
    const f = pedido(); f.set("valor", "801"); await expect(efetivarTransferenciaSocio(f)).resolves.toEqual({ ok: false, mensagem: expect.stringContaining("supera seu saldo positivo") }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("não permite usar impostos ou demais reservas", async () => {
    m.painel.mockResolvedValue({ ...painel(), bancoEmpresa: { id: "pj", saldoSistema: 1100 } });
    await expect(efetivarTransferenciaSocio(pedido())).resolves.toEqual({ ok: false, mensagem: expect.stringContaining("valores reservados") }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("exige conciliação quando o saldo ainda não é confiável", async () => {
    m.painel.mockResolvedValue({ ...painel(), bloqueios: ["Saldo precisa conciliar"] });
    await expect(efetivarTransferenciaSocio(pedido())).resolves.toEqual({ ok: false, mensagem: expect.stringContaining("Concilie") }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("não transfere com posição obsoleta", async () => {
    const p = painel(); p.socios[0].transferenciasRealizadas = 20; m.painel.mockResolvedValue(p);
    await expect(efetivarTransferenciaSocio(pedido())).resolves.toEqual({ ok: false, mensagem: expect.stringContaining("posição do sócio mudou") }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("repetição após sucesso não movimenta novamente", async () => {
    m.anterior = transferencia; await expect(efetivarTransferenciaSocio(pedido())).resolves.toEqual({ ok: true, saldoSistema: 2000 }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("repetição com outro valor exige atualizar", async () => {
    m.anterior = { ...transferencia, valor: 100 }; await expect(efetivarTransferenciaSocio(pedido())).resolves.toEqual({ ok: false, mensagem: expect.stringContaining("Já existe") }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("não escolhe arbitrariamente entre contas do sócio", async () => {
    m.destinos.push({ id: "outra" }); await expect(efetivarTransferenciaSocio(pedido())).resolves.toEqual({ ok: false, mensagem: expect.stringContaining("única conta") }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("valida operação reutilizada por requisição concorrente", async () => {
    m.rpc.mockResolvedValue({ data: { transferencia: { ...transferencia, valor: 200 }, reused: true }, error: null });
    await expect(efetivarTransferenciaSocio(pedido())).resolves.toEqual({ ok: false, mensagem: expect.stringContaining("concorrente") });
  });
  it("devolve bloqueio como dados JSON preservados em produção, sem lançar exceção", async () => {
    m.painel.mockResolvedValue({ ...painel(), bloqueios: ["Conciliar 98 contas pagas sem saída vinculada."] });
    const resultado = JSON.parse(JSON.stringify(await efetivarTransferenciaSocio(pedido())));
    expect(resultado).toEqual({ ok: false, mensagem: expect.stringContaining("Conciliar 98 contas") });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("não vaza detalhes internos quando falha a leitura do painel", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      m.painel.mockRejectedValue(new Error("segredo-interno-do-banco"));
      const resultado = await efetivarTransferenciaSocio(pedido());
      expect(resultado).toEqual({ ok: false, mensagem: expect.stringContaining("Referência:") });
      expect(JSON.stringify(resultado)).not.toContain("segredo-interno"); expect(m.rpc).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it("não vaza erros SQL devolvidos pela RPC", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      m.rpc.mockResolvedValue({ data: null, error: { message: "SQL sigiloso" } });
      const resultado = await efetivarTransferenciaSocio(pedido());
      expect(resultado).toEqual({ ok: false, mensagem: expect.stringContaining("não foi confirmada") });
      expect(JSON.stringify(resultado)).not.toContain("SQL sigiloso");
    } finally { log.mockRestore(); }
  });

});
