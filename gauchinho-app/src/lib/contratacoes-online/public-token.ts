import { randomBytes } from "crypto";

/** Token URL-safe, não sequencial (~22 chars base64url). */
export function generatePublicToken(): string {
  return randomBytes(16).toString("base64url");
}

export function isValidPublicToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(token);
}
