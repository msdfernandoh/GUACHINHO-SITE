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
  // Masters com visão completa não precisam da lista; demais perfis e
  // quem tem leads_apenas_proprios precisam para liberar leads de evento.
  if (!isMaster(perfil) || leadsApenasProprios) {
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
  const eventoId = lead.evento_id ?? null;
  const isAssigned = lead.srd_responsavel_id === scope.usuarioId;
  const inEventAllowList =
    !!eventoId &&
    scope.eventosRestritos.has(eventoId) &&
    scope.eventosRestritos.get(eventoId)!.has(scope.usuarioId);

  // Visão restrita: só leads em que é responsável OU leads de evento
  // em que foi marcado como consultor com acesso.
  if (scope.leadsApenasProprios) {
    if (isAssigned) return true;
    if (inEventAllowList) return true;
    return false;
  }

  // Visão completa: master vê tudo
  if (isMaster(scope.perfil)) return true;

  // Demais com visão completa: respeitam allow-list do evento
  if (eventoId && scope.eventosRestritos.has(eventoId)) {
    return inEventAllowList;
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
