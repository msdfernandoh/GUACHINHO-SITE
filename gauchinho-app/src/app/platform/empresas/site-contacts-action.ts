"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";
import { contactNumber } from "@/lib/tenant/site-contacts";
import { invalidateTenantHostCache } from "@/lib/tenant/tenant-host-cache";

export async function salvarContatosSiteAction(_prev: { message: string; ok: boolean }, form: FormData) {
  if (!(await isPlatformSuperadmin())) return { ok: false, message: "Acesso restrito à administração SaaS." };
  const empresaId = String(form.get("empresa_id") || "");
  if (!/^[\da-f-]{36}$/i.test(empresaId)) return { ok: false, message: "Empresa inválida." };
  const telefone = String(form.get("telefone") || "").trim();
  const whatsapp = String(form.get("whatsapp") || "").trim();
  if ((telefone && !contactNumber(telefone)) || (whatsapp && !contactNumber(whatsapp, true))) {
    return { ok: false, message: "Informe números válidos com DDD. Telefone também aceita 0800." };
  }
  const db = await createClient();
  // Atualização parcial: não altera identidade, publicação, modelo ou cadastro fiscal.
  const { data, error } = await db.from("empresa_branding").update({ telefone, whatsapp })
    .eq("empresa_id", empresaId).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: "Não foi possível salvar. Verifique o cadastro de identidade da empresa." };
  invalidateTenantHostCache();
  revalidatePath(`/platform/empresas/${empresaId}`);
  revalidatePath("/", "layout");
  return { ok: true, message: "Contatos públicos salvos somente para esta empresa." };
}
