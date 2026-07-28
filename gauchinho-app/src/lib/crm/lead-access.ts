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
  // Allow-list do evento só importa para visão completa (não-master).
  // Com leads_apenas_proprios, o filtro é só por consultor responsável.
  if (!leadsApenasProprios && !isMaster(perfil)) {
    try {
      const admin = createAdminClient();
      const { data: eventos, error: evErr } = await admin
        .from("eventos")
        .select("id")
        .eq("leads_acesso_todos", false);
      if (!evErr) {
        const ids = (eventos ?? []).map((e) => e.id as string);
        if (ids.length) {
          const { data: links } = await admin
            .from("eventos_leads_usuarios")
            .select("evento_id, usuario_id")
            .in("evento_id", ids);
          for (const id of ids) eventosRestritos.set(id, new Set());
          for (const row of links ?? []) {
            const set = eventosRestritos.get(row.evento_id as string);
            if (set) set.add(String(row.usuario_id));
          }
        }
      }
    } catch (e) {
      console.error("[loadLeadAccessScope] ignore:", e instanceof Error ? e.message : e);
    }
  }
  return { usuarioId, perfil, leadsApenasProprios, eventosRestritos };
}

function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return String(a) === String(b);
}

export function leadVisibleForScope(
  lead: Pick<LeadListRow, "srd_responsavel_id" | "evento_id"> & { evento_id?: string | null },
  scope: LeadAccessScope,
): boolean {
  const eventoId = lead.evento_id ?? null;
  const isAssigned = sameId(lead.srd_responsavel_id, scope.usuarioId);
  const inEventAllowList =
    !!eventoId &&
    scope.eventosRestritos.has(eventoId) &&
    scope.eventosRestritos.get(eventoId)!.has(scope.usuarioId);

  // Visão restrita: SOMENTE leads em que o usuário é o consultor responsável.
  // (Marcado no evento NÃO libera leads de outros consultores.)
  if (scope.leadsApenasProprios) {
    return isAssigned;
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
