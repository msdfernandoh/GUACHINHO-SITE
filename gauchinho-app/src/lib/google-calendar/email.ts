const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function isGmailAddress(email: string | null | undefined): boolean {
  if (!email?.includes("@")) return false;
  const domain = email.split("@").pop()?.trim().toLowerCase();
  return !!domain && GMAIL_DOMAINS.has(domain);
}
