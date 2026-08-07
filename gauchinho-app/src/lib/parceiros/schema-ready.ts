import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  FASE3_ADMIN_PARTICIPANTES_ENABLED,
  FASE3_PARCEIRO_SITES_ADMIN_ENABLED,
  FASE3_VERCEL_DOMAINS_ENABLED,
} from "./constants";

async function tableExists(table: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("does not exist") || msg.includes("schema cache") || error.code === "42P01") {
        return false;
      }
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Telas admin da Fase 3 só consultam o banco quando flag + schema 045.
 */
export async function isFase3ParticipantesSchemaReady(): Promise<boolean> {
  if (!FASE3_ADMIN_PARTICIPANTES_ENABLED) return false;
  return tableExists("participantes_comerciais");
}

export async function isFase3ParceiroSitesAdminReady(): Promise<boolean> {
  if (!FASE3_PARCEIRO_SITES_ADMIN_ENABLED) return false;
  return tableExists("parceiro_sites");
}

export function fase3AdminDisabledMessage(): string {
  if (!FASE3_ADMIN_PARTICIPANTES_ENABLED) {
    return "Módulo de participantes/organizações desabilitado (FASE3_ADMIN_PARTICIPANTES_ENABLED≠true).";
  }
  return "Schema da Fase 3 (migration 045) ainda não está disponível neste ambiente.";
}

export function fase3SitesAdminDisabledMessage(): string {
  if (!FASE3_PARCEIRO_SITES_ADMIN_ENABLED) {
    return "Admin de sites de parceiros desabilitado (FASE3_PARCEIRO_SITES_ADMIN_ENABLED≠true). Sem rota pública nesta rodada.";
  }
  return "Tabela parceiro_sites indisponível neste ambiente.";
}

/** Flag E5 isolada — mutações Vercel só com flag + credencial (ver vercel-domains.server). */
export function isFase3VercelDomainsFlagOn(): boolean {
  return FASE3_VERCEL_DOMAINS_ENABLED;
}