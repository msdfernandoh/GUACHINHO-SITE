import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean { if (!secret || !signatureHeader || !/^sha256=[a-f0-9]{64}$/.test(signatureHeader))
    return false; const a = Buffer.from(signatureHeader); const b = Buffer.from("sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")); return a.length === b.length && timingSafeEqual(a, b); }
