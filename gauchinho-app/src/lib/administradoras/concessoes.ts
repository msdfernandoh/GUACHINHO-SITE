import "server-only";

import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { createClient } from "@/lib/supabase/server";
import { requireGerenciarAdministradorasEmpresa } from "./authorization";
import { writeAdministradorasAuditLog } from "./audit";
import { AUDIT_ACTIONS_ADMINISTRADORAS, EMPRESA_ADMINISTRADORA_STATUS } from "./constants";
import type {
  Administradora,
  EmpresaAdministradora,
  EmpresaAdministradoraStatus,
} from "./types";

export type EmpresaAdministradoraConcessaoRow = {
  id: string;
  empresa_id: string;
  administradora_id: string;
  status: EmpresaAdministradoraStatus;
  codigo_franquia: string | null;
  codigo_comercial: string | null;
  contato_interno: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  administradora: Pick<
    Administradora,
    "id" | "nome" | "nome_fantasia" | "slug" | "status" | "logo_url"
  >;
};

export type EmpresaAdministradoraLocalFields = {
  codigo_franquia?: string | null;
  codigo_comercial?: string | null;
  contato_interno?: string | null;
  observacoes?: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return t.length ? t : null;
}

function mapUniqueConcessaoError(message: string): string | null {
  const m = message.toLowerCase();
  if (
    m.includes("empresa_administradoras_empresa_admin") ||
    (m.includes("unique") && m.includes("empresa") && m.includes("administradora")) ||
    m.includes("duplicate key")
  ) {
    return "Esta administradora já está vinculada à empresa.";
  }
  return null;
}

function friendlyError(error: { message: string }): Error {
  return new Error(mapUniqueConcessaoError(error.message) ?? "Não foi possível salvar a concessão.");
}

async function getUsuarioIdOrNull(): Promise<string | null> {
  const u = await getUsuarioNegocio();
  return u?.id ?? null;
}

function unwrapAdmin(
  value:
    | EmpresaAdministradoraConcessaoRow["administradora"]
    | EmpresaAdministradoraConcessaoRow["administradora"][]
    | null,
): EmpresaAdministradoraConcessaoRow["administradora"] | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Lista concessões da empresa — somente PLATFORM_SUPERADMIN. */
export async function getEmpresaAdministradorasForSuperadmin(
  empresaId: string,
): Promise<EmpresaAdministradoraConcessaoRow[]> {
  await requireGerenciarAdministradorasEmpresa();
  if (!empresaId) throw new Error("Empresa inválida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresa_administradoras")
    .select(
      `
      id,
      empresa_id,
      administradora_id,
      status,
      codigo_franquia,
      codigo_comercial,
      contato_interno,
      observacoes,
      created_at,
      updated_at,
      administradora:administradoras(id, nome, nome_fantasia, slug, status, logo_url)
    `,
    )
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows: EmpresaAdministradoraConcessaoRow[] = [];
  for (const raw of data ?? []) {
    const admin = unwrapAdmin(
      raw.administradora as
        | EmpresaAdministradoraConcessaoRow["administradora"]
        | EmpresaAdministradoraConcessaoRow["administradora"][]
        | null,
    );
    if (!admin) continue;
    rows.push({
      id: raw.id as string,
      empresa_id: raw.empresa_id as string,
      administradora_id: raw.administradora_id as string,
      status: raw.status as EmpresaAdministradoraStatus,
      codigo_franquia: (raw.codigo_franquia as string | null) ?? null,
      codigo_comercial: (raw.codigo_comercial as string | null) ?? null,
      contato_interno: (raw.contato_interno as string | null) ?? null,
      observacoes: (raw.observacoes as string | null) ?? null,
      created_at: raw.created_at as string,
      updated_at: raw.updated_at as string,
      administradora: admin,
    });
  }
  return rows;
}

/**
 * Administradoras globais ATIVAS ainda não vinculadas à empresa.
 * Somente Superadmin — nunca expor a tenant.
 */
export async function listAdministradorasCandidatasParaEmpresa(
  empresaId: string,
): Promise<Pick<Administradora, "id" | "nome" | "slug" | "status">[]> {
  await requireGerenciarAdministradorasEmpresa();
  const supabase = await createClient();

  const [{ data: globais, error: gErr }, { data: vinculos, error: vErr }] = await Promise.all([
    supabase
      .from("administradoras")
      .select("id, nome, slug, status")
      .eq("status", "ATIVA")
      .order("nome"),
    supabase.from("empresa_administradoras").select("administradora_id").eq("empresa_id", empresaId),
  ]);

  if (gErr) throw new Error(gErr.message);
  if (vErr) throw new Error(vErr.message);

  const linked = new Set((vinculos ?? []).map((v) => v.administradora_id as string));
  return ((globais ?? []) as Pick<Administradora, "id" | "nome" | "slug" | "status">[]).filter(
    (a) => !linked.has(a.id),
  );
}

export async function grantAdministradoraToEmpresa(input: {
  empresaId: string;
  administradoraId: string;
  status?: EmpresaAdministradoraStatus;
  local?: EmpresaAdministradoraLocalFields;
}): Promise<EmpresaAdministradora> {
  await requireGerenciarAdministradorasEmpresa();

  const empresaId = input.empresaId?.trim();
  const administradoraId = input.administradoraId?.trim();
  if (!empresaId || !administradoraId) {
    throw new Error("Empresa e administradora são obrigatórias.");
  }

  const status = (input.status ?? EMPRESA_ADMINISTRADORA_STATUS.ATIVA) as EmpresaAdministradoraStatus;
  if (!["ATIVA", "INATIVA", "SUSPENSA"].includes(status)) {
    throw new Error("Status de vínculo inválido.");
  }

  const supabase = await createClient();

  const { data: empresa, error: eErr } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", empresaId)
    .maybeSingle();
  if (eErr) throw new Error(eErr.message);
  if (!empresa) throw new Error("Empresa inválida.");

  const { data: adminGlobal, error: aErr } = await supabase
    .from("administradoras")
    .select("id, status, slug, nome")
    .eq("id", administradoraId)
    .maybeSingle();
  if (aErr) throw new Error(aErr.message);
  if (!adminGlobal) throw new Error("Administradora inválida.");
  if (adminGlobal.status !== "ATIVA") {
    throw new Error("Não é possível conceder uma administradora global INATIVA.");
  }

  const usuarioId = await getUsuarioIdOrNull();
  const payload = {
    empresa_id: empresaId,
    administradora_id: administradoraId,
    status,
    codigo_franquia: trimOrNull(input.local?.codigo_franquia),
    codigo_comercial: trimOrNull(input.local?.codigo_comercial),
    contato_interno: trimOrNull(input.local?.contato_interno),
    observacoes: trimOrNull(input.local?.observacoes),
    configuracoes: {},
    created_by_usuario_id: usuarioId,
    updated_by_usuario_id: usuarioId,
  };

  const { data, error } = await supabase
    .from("empresa_administradoras")
    .insert(payload)
    .select(
      "id, empresa_id, administradora_id, status, codigo_franquia, codigo_comercial, contato_interno, observacoes, configuracoes, created_at, updated_at",
    )
    .single();

  if (error) throw friendlyError(error);

  const created = data as EmpresaAdministradora;
  await writeAdministradorasAuditLog({
    action: AUDIT_ACTIONS_ADMINISTRADORAS.concessaoCriada,
    companyId: empresaId,
    privileged: true,
    details: {
      vinculo_id: created.id,
      empresa_id: empresaId,
      administradora_id: administradoraId,
      administradora_slug: adminGlobal.slug,
      depois: {
        status: created.status,
        codigo_franquia: created.codigo_franquia,
        codigo_comercial: created.codigo_comercial,
      },
    },
  });

  return created;
}

export async function updateEmpresaAdministradora(
  vinculoId: string,
  local: EmpresaAdministradoraLocalFields,
): Promise<EmpresaAdministradora> {
  await requireGerenciarAdministradorasEmpresa();
  if (!vinculoId) throw new Error("Vínculo inválido.");

  const supabase = await createClient();
  const { data: before, error: bErr } = await supabase
    .from("empresa_administradoras")
    .select(
      "id, empresa_id, administradora_id, status, codigo_franquia, codigo_comercial, contato_interno, observacoes, configuracoes, created_at, updated_at",
    )
    .eq("id", vinculoId)
    .maybeSingle();
  if (bErr) throw new Error(bErr.message);
  if (!before) throw new Error("Concessão não encontrada.");

  const usuarioId = await getUsuarioIdOrNull();
  const patch = {
    codigo_franquia: trimOrNull(local.codigo_franquia),
    codigo_comercial: trimOrNull(local.codigo_comercial),
    contato_interno: trimOrNull(local.contato_interno),
    observacoes: trimOrNull(local.observacoes),
    updated_by_usuario_id: usuarioId,
  };

  const { data, error } = await supabase
    .from("empresa_administradoras")
    .update(patch)
    .eq("id", vinculoId)
    .select(
      "id, empresa_id, administradora_id, status, codigo_franquia, codigo_comercial, contato_interno, observacoes, configuracoes, created_at, updated_at",
    )
    .maybeSingle();

  if (error) throw friendlyError(error);
  if (!data) throw new Error("Concessão não encontrada.");

  const after = data as EmpresaAdministradora;
  await writeAdministradorasAuditLog({
    action: AUDIT_ACTIONS_ADMINISTRADORAS.concessaoAtualizada,
    companyId: after.empresa_id,
    privileged: true,
    details: {
      vinculo_id: after.id,
      empresa_id: after.empresa_id,
      administradora_id: after.administradora_id,
      antes: {
        codigo_franquia: before.codigo_franquia,
        codigo_comercial: before.codigo_comercial,
        contato_interno: before.contato_interno,
        observacoes: before.observacoes,
      },
      depois: {
        codigo_franquia: after.codigo_franquia,
        codigo_comercial: after.codigo_comercial,
        contato_interno: after.contato_interno,
        observacoes: after.observacoes,
      },
    },
  });

  return after;
}

export async function setEmpresaAdministradoraStatus(
  vinculoId: string,
  status: EmpresaAdministradoraStatus,
): Promise<EmpresaAdministradora> {
  await requireGerenciarAdministradorasEmpresa();
  if (!vinculoId) throw new Error("Vínculo inválido.");
  if (!["ATIVA", "INATIVA", "SUSPENSA"].includes(status)) {
    throw new Error("Status de vínculo inválido.");
  }

  const supabase = await createClient();
  const { data: before, error: bErr } = await supabase
    .from("empresa_administradoras")
    .select(
      "id, empresa_id, administradora_id, status, codigo_franquia, codigo_comercial, contato_interno, observacoes, configuracoes, created_at, updated_at",
    )
    .eq("id", vinculoId)
    .maybeSingle();
  if (bErr) throw new Error(bErr.message);
  if (!before) throw new Error("Concessão não encontrada.");

  if (before.status === status) return before as EmpresaAdministradora;

  // Não permitir “ATIVAR” vínculo se a administradora global estiver INATIVA
  if (status === "ATIVA") {
    const { data: adminGlobal, error: aErr } = await supabase
      .from("administradoras")
      .select("id, status")
      .eq("id", before.administradora_id)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!adminGlobal || adminGlobal.status !== "ATIVA") {
      throw new Error(
        "Não é possível ativar o vínculo enquanto a administradora global estiver INATIVA.",
      );
    }
  }

  const usuarioId = await getUsuarioIdOrNull();
  const { data, error } = await supabase
    .from("empresa_administradoras")
    .update({ status, updated_by_usuario_id: usuarioId })
    .eq("id", vinculoId)
    .select(
      "id, empresa_id, administradora_id, status, codigo_franquia, codigo_comercial, contato_interno, observacoes, configuracoes, created_at, updated_at",
    )
    .maybeSingle();

  if (error) throw friendlyError(error);
  if (!data) throw new Error("Concessão não encontrada.");

  const after = data as EmpresaAdministradora;
  await writeAdministradorasAuditLog({
    action: AUDIT_ACTIONS_ADMINISTRADORAS.concessaoStatusAlterado,
    companyId: after.empresa_id,
    privileged: true,
    details: {
      vinculo_id: after.id,
      empresa_id: after.empresa_id,
      administradora_id: after.administradora_id,
      antes: { status: before.status },
      depois: { status: after.status },
    },
  });

  return after;
}
