export type SiteContacts = { telefone?: string; whatsapp?: string };

export function contactNumber(value: unknown, whatsapp = false): string {
  if (typeof value !== "string" || value.length > 40 || !/^[+\d\s().-]*$/.test(value)) return "";
  const digits = value.replace(/\D/g, "");
  if (!whatsapp && /^0800\d{7}$/.test(digits)) return digits;
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  return /^[1-9]{2}\d{8,9}$/.test(local) ? (whatsapp ? `55${local}` : local) : "";
}

export function resolveSiteContacts(company: SiteContacts, defaults?: SiteContacts): SiteContacts {
  return {
    telefone: company.telefone?.trim() || defaults?.telefone?.trim() || "",
    whatsapp: company.whatsapp?.trim() || defaults?.whatsapp?.trim() || "",
  };
}
