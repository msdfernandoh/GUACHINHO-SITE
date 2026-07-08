"use server";

import { inscreverConvidadoListaPublica } from "@/lib/comercial-eventos/listas-convidados-public";
import type { GuestDraft } from "@/lib/comercial-eventos/listas-convidados-types";

export async function publicAddConvidadoListaAction(slug: string, guest: GuestDraft) {
  const result = await inscreverConvidadoListaPublica(slug, guest);
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const };
}
