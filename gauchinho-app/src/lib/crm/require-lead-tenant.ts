import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentTenantContext } from "@/lib/tenant/context";
import { GAUCHINHO_SLUG } from "@/lib/tenant/constants";

/** Autoriza identificadores vindos da URL ou de Server Actions pelo tenant do host. */
export async function requireLeadInCurrentTenant(leadId: string): Promise<void> {
  const { empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  let query = supabase.from("leads").select("id").eq("id", leadId);
  query = empresaAtiva.slug === GAUCHINHO_SLUG
    ? query.or(`empresa_id.eq.${empresaAtiva.id},empresa_id.is.null`)
    : query.eq("empresa_id", empresaAtiva.id);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error("Lead não encontrado nesta empresa");
}

export async function requireLeadIdsInCurrentTenant(leadIds: string[]): Promise<void> {
  const ids = [...new Set(leadIds)];
  if (!ids.length) return;
  const { empresaAtiva } = await requireCurrentTenantContext();
  const supabase = await createClient();
  let query = supabase.from("leads").select("id").in("id", ids);
  query = empresaAtiva.slug === GAUCHINHO_SLUG
    ? query.or(`empresa_id.eq.${empresaAtiva.id},empresa_id.is.null`)
    : query.eq("empresa_id", empresaAtiva.id);
  const { data, error } = await query;
  if (error || (data?.length ?? 0) !== ids.length) {
    throw new Error("Um ou mais leads não pertencem a esta empresa");
  }
}
