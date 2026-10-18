import "server-only";
import crypto from "crypto";
import { getMetaAppSecret } from "./config";

/**
 * Valida a assinatura X-Hub-Signature-256 enviada pela Meta no webhook.
 * Compara HMAC-SHA256(appSecret, rawBody) com o header. Timing-safe.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", getMetaAppSecret()).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
