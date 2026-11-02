import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { criarTokenConexao, lerTokenConexao } from "./connection-token";
import { verifyWebhookSignature } from "./signature";
import { erroSignup, numeroE164, numerosConferem, origemConexao } from "./validation";
const ids = { empresa_id: "11111111-1111-4111-8111-111111111111", instancia_id: "22222222-2222-4222-8222-222222222222", usuario_id: "33333333-3333-4333-8333-333333333333", retorno: "https://franquia.example", revisao: 1 };
afterEach(() => vi.unstubAllEnvs());
describe("link central de conexão", () => {
    it("assina a identidade interna, empresa e instância por exatamente dez minutos", () => { vi.stubEnv("ROBO_CREDENTIALS_ENCRYPTION_KEY", "teste-unitario"); const r = criarTokenConexao(ids, 1000000); expect(lerTokenConexao(r.token, 1000000)).toMatchObject(ids); expect(r.claims.exp - r.claims.iat).toBe(600); });
    it("recusa link expirado", () => { vi.stubEnv("ROBO_CREDENTIALS_ENCRYPTION_KEY", "teste"); const r = criarTokenConexao(ids, 1000000); expect(() => lerTokenConexao(r.token, 1600000)).toThrow("expirado"); });
    it("recusa mudança de empresa mesmo conservando a assinatura", () => { vi.stubEnv("ROBO_CREDENTIALS_ENCRYPTION_KEY", "teste"); const r = criarTokenConexao(ids); const [p, s] = r.token.split('.'); const c = JSON.parse(Buffer.from(p, "base64url").toString()); c.empresa_id = c.instancia_id; expect(() => lerTokenConexao(Buffer.from(JSON.stringify(c)).toString("base64url") + "." + s)).toThrow("inválido"); });
    it("recusa assinatura produzida com outra chave", () => { vi.stubEnv("ROBO_CREDENTIALS_ENCRYPTION_KEY", "teste"); const r = criarTokenConexao(ids); vi.stubEnv("ROBO_CREDENTIALS_ENCRYPTION_KEY", "outra"); expect(() => lerTokenConexao(r.token)).toThrow(); });
    it("recusa token com sufixo ou payload excessivo", () => { vi.stubEnv("ROBO_CREDENTIALS_ENCRYPTION_KEY", "teste"); const r = criarTokenConexao(ids); expect(() => lerTokenConexao(r.token + ".extra")).toThrow(); expect(() => lerTokenConexao("a".repeat(3001))).toThrow(); });
});
describe("assinatura webhook", () => {
    const raw = '{"entry":[]}';
    const secret = "somente-fixture";
    const sig = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    it("aceita corpo exato assinado", () => expect(verifyWebhookSignature(raw, sig, secret)).toBe(true));
    it("recusa corpo alterado", () => expect(verifyWebhookSignature(raw + " ", sig, secret)).toBe(false));
    it("nega segredo ou assinatura ausentes e formatos inválidos", () => { for (const s of [null, "sha256=abc", "sha256=" + "0".repeat(64)])
        expect(verifyWebhookSignature(raw, s, secret)).toBe(false); expect(verifyWebhookSignature(raw, sig, "")).toBe(false); });
});
describe("cadastro e eventos Meta", () => {
    it("normaliza E164 e compara retornos formatados", () => { expect(numeroE164("+55 (66) 99999-1234")).toBe("+5566999991234"); expect(numerosConferem("+5566999991234", "55 66 99999-1234")).toBe(true); expect(numerosConferem("+5566999991234", "+5566999995678")).toBe(false); expect(numerosConferem(null, null)).toBe(false); });
    it("nega número sem DDI e número excessivo", () => { expect(() => numeroE164("66999991234")).toThrow(); expect(() => numeroE164("+" + "1".repeat(16))).toThrow(); });
    it("mantém apenas domínio HTTPS sem credenciais ou caminhos", () => { expect(origemConexao("admin.example.com")).toBe("https://admin.example.com"); for (const d of ["http://admin.example.com", "https://u:p@admin.example.com", "https://admin.example.com/a", "https://admin.example.com?q=a"])
        expect(() => origemConexao(d)).toThrow(); });
    it("mostra a etapa de cancelamento e o motivo de erro", () => { expect(erroSignup({ event: "CANCEL", data: { current_step: "VERIFY_PHONE" } })).toContain("VERIFY_PHONE"); expect(erroSignup({ event: "ERROR", data: { error_message: "Sem permissão" } })).toContain("Sem permissão"); expect(erroSignup({ event: "FINISH", data: {} })).toBeNull(); });
});
