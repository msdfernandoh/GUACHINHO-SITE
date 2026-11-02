import { z } from "zod";
export const uuid = z.string().uuid();
export const metaId = z.string().regex(/^\d{5,30}$/, "ID da Meta inválido");
export function numeroE164(v: string) { const n = v.replace(/[^\d+]/g, ""); if (!/^\+[1-9]\d{7,14}$/.test(n))
    throw new Error("Informe o número internacional com +, DDI e DDD."); return n; }
export function numerosConferem(esperado: string | null, retornado: string | null) { return Boolean(esperado && retornado && esperado.replace(/\D/g, "") === retornado.replace(/\D/g, "")); }
export function origemConexao(dominio: string) { const u = new URL(dominio.includes("://") ? dominio : "https://" + dominio); if (u.protocol !== "https:" || u.username || u.password || u.port || u.pathname !== "/" || u.search || u.hash || !/^[a-z0-9.-]+$/i.test(u.hostname))
    throw new Error("Informe somente um domínio HTTPS válido, sem caminho."); return u.origin; }
export function erroSignup(evento: unknown): string | null { const e = evento as {
    event?: string;
    data?: {
        error_message?: string;
        current_step?: string;
    };
}; if (e?.event === "ERROR")
    return "A Meta informou: " + (e.data?.error_message || e.data?.current_step || "falha na autorização"); if (e?.event === "CANCEL")
    return "Conexão cancelada na etapa: " + (e.data?.current_step || "autorização"); return null; }
