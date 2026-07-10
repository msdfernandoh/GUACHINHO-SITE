import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadListRow } from "./types";
import type { Perfil } from "@/lib/auth/permissions";
import { isMaster } from "@/lib/auth/permissions";

export type LeadAccessScope = {
  usuarioId: string;
  perfil: Perfil;
  leadsApenasProprios: boolean;
  /** evento_id → usuários com acesso quando leads_acesso_todos = false */
  eventosRestritos: Map<string, Set<string>>;
};

export async function loadLeadAccessScope(
  usuarioId: string,
  perfil: Perfil,
  leadsApenasProprios: boolean,
): Promise<LeadAccessScope> {
  const eventosRestritos = new Map<string, Set<string>>();
  if (!isMaster(perfil)) {
    const admin = createAdminClient();
    const { data: eventos } = await admin
      .from("eventos")
      .select("id")
      .eq("leads_acesso_todos", false);
    const ids = (eventos ?? []).map((e) => e.id as string);
    if (ids.length) {
      const { data: links } = await admin
        .from("eventos_leads_usuarios")
        .select("evento_id, usuario_id")
        .in("evento_id", ids);
      for (const id of ids) eventosRestritos.set(id, new Set());
      for (const row of links ?? []) {
        const set = eventosRestritos.get(row.evento_id as string);
        if (set) set.add(row.usuario_id as string);
      }
    }
  }
  return { usuarioId, perfil, leadsApenasProprios, eventosRestritos };
}

export function leadVisibleForScope(
  lead: Pick<LeadListRow, "srd_responsavel_id" | "evento_id"> & { evento_id?: string | null },
  scope: LeadAccessScope,
): boolean {
  if (isMaster(scope.perfil)) return true;
  if (scope.leadsApenasProprios && lead.srd_responsavel_id !== scope.usuarioId) {
    return false;
  }
  const eventoId = lead.evento_id ?? null;
  if (eventoId && scope.eventosRestritos.has(eventoId)) {
    const allowed = scope.eventosRestritos.get(eventoId)!;
    if (!allowed.has(scope.usuarioId)) return false;
  }
  return true;
}

export function filterLeadsByScope<T extends LeadListRow & { evento_id?: string | null }>(
  rows: T[],
  scope: LeadAccessScope,
): T[] {
  if (isMaster(scope.perfil) && !scope.leadsApenasProprios) return rows;
  return rows.filter((r) => leadVisibleForScope(r, scope));
}
