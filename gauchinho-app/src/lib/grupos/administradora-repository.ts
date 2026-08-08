import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RACON_ADMINISTRADORA_ID, RACON_SLUG } from "@/lib/administradoras/constants";
import type { Administradora } from "@/lib/administradoras/types";
import type { GrupoConsorcio } from "@/lib/types";
import {
  buildGrupoAdministradoraDualWrite,
  resolveAdministradoraCandidateFromForm,
  resolveGrupoAdministradora,
  type GrupoAdministradoraDualWrite,
  type ResolvedGrupoAdministradora,
} from "./administradora";

export type GrupoWithAdministradora = GrupoConsorcio & {
  administradora_rel?: Pick<
    Administradora,
    "id" | "nome" | "nome_fantasia" | "slug" | "status" | "logo_url"
  > | null;
  administradora_resolvida: ResolvedGrupoAdministradora;
};

type AdminLite = Pick<
  Administradora,
  "id" | "nome" | "nome_fantasia" | "slug" | "status" | "logo_url"
>;

function unwrapAdmin(
  value: AdminLite | AdminLite[] | null | undefined,
): AdminLite | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Leitura pontual do catálogo global via service role.
 * Somente após assert de permissão de grupos no caller — não listar catálogo completo.
 */
async function loadAdministradoraByIdPrivileged(id: string): Promise<AdminLite> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("administradoras")
    .select("id, nome, nome_fantasia, slug, status, logo_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Administradora global do grupo não encontrada.");
  return data as AdminLite;
}

async function loadRaconGlobalPrivileged(): Promise<AdminLite> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("administradoras")
    .select("id, nome, nome_fantasia, slug, status, logo_url")
    .eq("id", RACON_ADMINISTRADORA_ID)
    .eq("slug", RACON_SLUG)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Administradora global Racon não encontrada.");
  return data as AdminLite;
}

/**
 * Dual-write para admin de grupos (staff/master).
 * Não expõe catálogo global ao tenant: resolve UUID explícito ou alias legado Racon.
 * Caller DEVE ter passado por assertCanManageGrupos (ou equivalente).
 */
export async function resolveGrupoAdministradoraDualWriteFromForm(input: {
  formData: FormData;
  existingText?: string | null;
  /** Preferência sobre o form (ex.: UUID já persistido na edição). */
  administradoraIdOverride?: string | null;
}): Promise<GrupoAdministradoraDualWrite> {
  const candidate = resolveAdministradoraCandidateFromForm({
    administradoraIdRaw:
      (input.administradoraIdOverride ?? "").trim() ||
      String(input.formData.get("administradora_id") ?? ""),
    administradoraTextRaw: String(input.formData.get("administradora") ?? ""),
  });

  const adminRow =
    candidate.mode === "uuid"
      ? await loadAdministradoraByIdPrivileged(candidate.id)
      : await loadRaconGlobalPrivileged();

  const administradoraId = candidate.mode === "uuid" ? candidate.id : adminRow.id;

  return buildGrupoAdministradoraDualWrite({
    administradoraId,
    administradora: adminRow,
    existingText: input.existingText,
    requestedText: String(input.formData.get("administradora") ?? ""),
  });
}

export async function getGrupoWithAdministradora(
  grupoId: string,
): Promise<GrupoWithAdministradora | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grupos_consorcio")
    .select(
      `
      *,
      administradora_rel:administradoras(id, nome, nome_fantasia, slug, status, logo_url)
    `,
    )
    .eq("id", grupoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const rel = unwrapAdmin(
    data.administradora_rel as AdminLite | AdminLite[] | null,
  );
  const catalog = rel ? new Map([[rel.id, rel]]) : undefined;
  const { administradora_rel: _drop, ...grupo } = data as Record<string, unknown> & {
    administradora_rel?: unknown;
  };
  const resolved = resolveGrupoAdministradora(
    {
      id: String(grupo.id),
      administradora_id: (grupo.administradora_id as string | null) ?? null,
      administradora: (grupo.administradora as string | null) ?? null,
    },
    catalog,
  );

  return {
    ...(grupo as GrupoConsorcio),
    administradora_rel: rel,
    administradora_resolvida: resolved,
  };
}

export async function listGruposWithAdministradora(filters?: {
  modalidade?: string;
  status?: string;
  q?: string;
  ativo?: boolean;
}): Promise<GrupoWithAdministradora[]> {
  const supabase = await createClient();
  let q = supabase
    .from("grupos_consorcio")
    .select(
      `
      *,
      administradora_rel:administradoras(id, nome, nome_fantasia, slug, status, logo_url)
    `,
    )
    .order("codigo_grupo", { ascending: true });

  if (filters?.modalidade) q = q.eq("modalidade", filters.modalidade);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.ativo != null) q = q.eq("ativo", filters.ativo);
  if (filters?.q) q = q.ilike("codigo_grupo", `%${filters.q}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const rel = unwrapAdmin(row.administradora_rel as AdminLite | AdminLite[] | null);
    const catalog = rel ? new Map([[rel.id, rel]]) : undefined;
    const { administradora_rel: _drop, ...grupo } = row as Record<string, unknown> & {
      administradora_rel?: unknown;
    };
    return {
      ...(grupo as GrupoConsorcio),
      administradora_rel: rel,
      administradora_resolvida: resolveGrupoAdministradora(
        {
          id: String(grupo.id),
          administradora_id: (grupo.administradora_id as string | null) ?? null,
          administradora: (grupo.administradora as string | null) ?? null,
        },
        catalog,
      ),
    };
  });
}
