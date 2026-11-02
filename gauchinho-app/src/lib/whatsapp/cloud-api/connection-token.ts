import "server-only";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { getMasterEncryptionKey } from "@/lib/automacoes/robos/cryptoService";
import { z } from "zod";
const claims = z.object({ empresa_id: z.string().uuid(), instancia_id: z.string().uuid(), usuario_id: z.string().uuid(), jti: z.string().uuid(), revisao: z.number().int().positive(), retorno: z.string().url(), iat: z.number().int(), exp: z.number().int() });
export type ConnectionClaims = z.infer<typeof claims>;
function assinatura(payload: string) { return createHmac("sha256", getMasterEncryptionKey()).update("whatsapp-conectar-v1:" + payload).digest("base64url"); }
export function criarTokenConexao(input: Omit<ConnectionClaims, "iat" | "exp" | "jti">, now = Date.now()) { const iat = Math.floor(now / 1000); const c = claims.parse({ ...input, iat, exp: iat + 600, jti: randomUUID() }); const p = Buffer.from(JSON.stringify(c)).toString("base64url"); return { token: p + "." + assinatura(p), claims: c }; }
export function lerTokenConexao(token: string, now = Date.now()): ConnectionClaims { if (token.length > 3000)
    throw new Error("Link de conexão inválido."); const [p, s, extra] = token.split("."); if (!p || !s || extra)
    throw new Error("Link de conexão inválido."); const a = Buffer.from(s); const b = Buffer.from(assinatura(p)); if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new Error("Link de conexão inválido."); let c: ConnectionClaims; try {
    c = claims.parse(JSON.parse(Buffer.from(p, "base64url").toString("utf8")));
}
catch {
    throw new Error("Link de conexão inválido.");
} const sec = Math.floor(now / 1000); if (c.exp <= sec || c.iat > sec + 30 || c.exp - c.iat !== 600)
    throw new Error("Link expirado. Abra uma nova conexão pelo ERP."); return c; }
