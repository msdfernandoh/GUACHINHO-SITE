import "server-only";

import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireGerenciarCatalogoAdministradoras } from "./authorization";
import { writeAdministradorasAuditLog } from "./audit";
import { AUDIT_ACTIONS_ADMINISTRADORAS } from "./constants";
import { throwAdministradoraNotFound } from "./errors";
import {
  diffAdministradoraFields,
  mapAdministradoraDbUniqueError,
  validateAdministradoraWriteInput,
  type AdministradoraWriteInput,
} from "./rules";
import type { Administradora, AdministradoraStatus } from "./types";

const SELECT_COLS =
  "id, nome, nome_fantasia, razao_social, cnpj, slug, logo_url, site_url, status, recursos_integracao, metadata, created_at, updated_at, created_by_usuario_id, updated_by_usuario_id";

function friendlyDbError(error: { message: string; code?: string }): Error {
  const mapped = mapAdministradoraDbUniqueError(error.message);
  return new Error(mapped ?? "Não foi possível salvar a administradora.");
}

async function getUsuarioIdOrNull(): Promise<string | null> {
  const u = await getUsuarioNegocio();
  return u?.id ?? null;
}

export async function getAdministradoraGlobalByIdForSuperadmin(
  id: string,
): Promise<Administradora> {
  await requireGerenciarCatalogoAdministradoras();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("administradoras")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throwAdministradoraNotFound();
  return data as Administradora;
}

/** Contagem agregada Superadmin: empresas/franqueadas vinculadas (não são administradoras). */
export async function countEmpresasVinculadasForAdministradora(
  administradoraId: string,
): Promise<number> {
  const map = await countEmpresasVinculadasByAdministradoraIds([administradoraId]);
  return map.get(administradoraId) ?? 0;
}

export async function countEmpresasVinculadasByAdministradoraIds(
  administradoraIds: string[],
): Promise<Map<string, number>> {
  await requireGerenciarCatalogoAdministradoras();
  const map = new Map<string, number>();
  for (const id of administradoraIds) map.set(id, 0);
  if (!administradoraIds.length) return map;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("empresa_administradoras")
    .select("administradora_id")
    .in("administradora_id", administradoraIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const id = row.administradora_id as string;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export type EmpresaFranqueadaVinculada = {
  empresa_id: string;
  nome_fantasia: string;
  slug: string;
  status_vinculo: string;
};

/** Lista empresas/franqueadas vinculadas — somente Superadmin; rótulo explícito. */
export async function listEmpresasFranqueadasVinculadas(
  administradoraId: string,
): Promise<EmpresaFranqueadaVinculada[]> {
  await requireGerenciarCatalogoAdministradoras();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("empresa_administradoras")
    .select(
      `
      empresa_id,
      status,
      empresa:empresas(nome_fantasia, slug)
    `,
    )
    .eq("administradora_id", administradoraId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const emp = Array.isArray(row.empresa) ? row.empresa[0] : row.empresa;
    return {
      empresa_id: row.empresa_id as string,
      nome_fantasia: (emp as { nome_fantasia?: string } | null)?.nome_fantasia ?? "—",
      slug: (emp as { slug?: string } | null)?.slug ?? "—",
      status_vinculo: row.status as string,
    };
  });
}

export async function createAdministradoraGlobal(
  input: AdministradoraWriteInput,
): Promise<Administradora> {
  await requireGerenciarCatalogoAdministradoras();
  const validated = validateAdministradoraWriteInput(input);
  if (!validated.ok) throw new Error(validated.error);

  const usuarioId = await getUsuarioIdOrNull();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("administradoras")
    .insert({
      ...validated.value,
      created_by_usuario_id: usuarioId,
      updated_by_usuario_id: usuarioId,
    })
    .select(SELECT_COLS)
    .single();

  if (error) throw friendlyDbError(error);

  const created = data as Administradora;
  await writeAdministradorasAuditLog({
    action: AUDIT_ACTIONS_ADMINISTRADORAS.criada,
    companyId: null,
    privileged: true,
    details: {
      administradora_id: created.id,
      slug: created.slug,
      status: created.status,
      depois: validated.value,
    },
  });

  return created;
}

export async function updateAdministradoraGlobal(
  id: string,
  input: AdministradoraWriteInput,
): Promise<Administradora> {
  await requireGerenciarCatalogoAdministradoras();
  const validated = validateAdministradoraWriteInput(input);
  if (!validated.ok) throw new Error(validated.error);

  const before = await getAdministradoraGlobalByIdForSuperadmin(id);
  const usuarioId = await getUsuarioIdOrNull();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("administradoras")
    .update({
      ...validated.value,
      updated_by_usuario_id: usuarioId,
    })
    .eq("id", id)
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) throw friendlyDbError(error);
  if (!data) throwAdministradoraNotFound();

  const after = data as Administradora;
  const diff = diffAdministradoraFields(before, after);
  await writeAdministradorasAuditLog({
    action: AUDIT_ACTIONS_ADMINISTRADORAS.editada,
    companyId: null,
    privileged: true,
    details: {
      administradora_id: id,
      campos_alterados: diff.campos,
      antes: diff.antes,
      depois: diff.depois,
      slug_alterado: before.slug !== after.slug,
      nota_slug:
        before.slug !== after.slug
          ? "Alteração de slug auditada; impacto futuro em URLs/referências deve ser considerado."
          : undefined,
    },
  });

  return after;
}

export async function setAdministradoraGlobalStatus(
  id: string,
  status: AdministradoraStatus,
): Promise<Administradora> {
  await requireGerenciarCatalogoAdministradoras();
  if (status !== "ATIVA" && status !== "INATIVA") {
    throw new Error("Status inválido. Use ATIVA ou INATIVA.");
  }

  const before = await getAdministradoraGlobalByIdForSuperadmin(id);
  if (before.status === status) return before;

  const usuarioId = await getUsuarioIdOrNull();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("administradoras")
    .update({ status, updated_by_usuario_id: usuarioId })
    .eq("id", id)
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) throw friendlyDbError(error);
  if (!data) throwAdministradoraNotFound();

  const after = data as Administradora;
  await writeAdministradorasAuditLog({
    action: AUDIT_ACTIONS_ADMINISTRADORAS.statusAlterado,
    companyId: null,
    privileged: true,
    details: {
      administradora_id: id,
      campos_alterados: ["status"],
      antes: { status: before.status },
      depois: { status: after.status },
    },
  });

  return after;
}
