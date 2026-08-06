import "server-only";

import { createClient } from "@/lib/supabase/server";
import { FASE3_ADMIN_PARTICIPANTES_ENABLED } from "./constants";

/**
 * Telas admin da Fase 3 só consultam o banco quando:
 * 1) feature flag explícita está ligada; e
 * 2) as tabelas da migration 045 existem.
 *
 * Evita apontar produção para tabelas inexistentes antes da aplicação da 045.
 */
export async function isFase3ParticipantesSchemaReady(): Promise<boolean> {
  if (!FASE3_ADMIN_PARTICIPANTES_ENABLED) return false;
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("participantes_comerciais")
      .select("id")
      .limit(1);
    if (error) {
      // 42P01 undefined_table / schema cache
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("does not exist") || msg.includes("schema cache") || error.code === "42P01") {
        return false;
      }
      // Outros erros (RLS/auth) ainda indicam que a tabela existe
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

export function fase3AdminDisabledMessage(): string {
  if (!FASE3_ADMIN_PARTICIPANTES_ENABLED) {
    return "Módulo de participantes/organizações desabilitado (FASE3_ADMIN_PARTICIPANTES_ENABLED≠true). Migration 045 ainda não deve ser usada em produção nesta rodada.";
  }
  return "Schema da Fase 3 (migration 045) ainda não está disponível neste ambiente.";
}
