"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  countEmpresasVinculadasByAdministradoraIds,
  createAdministradoraGlobal,
  getAdministradoraGlobalByIdForSuperadmin,
  listEmpresasFranqueadasVinculadas,
  setAdministradoraGlobalStatus,
  updateAdministradoraGlobal,
} from "@/lib/administradoras/mutations";
import { requireGerenciarCatalogoAdministradoras } from "@/lib/administradoras/authorization";
import { listAdministradorasGlobaisForSuperadmin } from "@/lib/administradoras/service";
import type { Administradora, AdministradoraStatus } from "@/lib/administradoras/types";

function parseJsonObjectField(raw: string, label: string): Record<string, unknown> {
  const text = raw.trim() || "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label}: JSON inválido.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label}: deve ser um objeto JSON.`);
  }
  return parsed as Record<string, unknown>;
}

function inputFromForm(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? ""),
    nome_fantasia: String(formData.get("nome_fantasia") ?? ""),
    razao_social: String(formData.get("razao_social") ?? ""),
    cnpj: String(formData.get("cnpj") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    logo_url: String(formData.get("logo_url") ?? ""),
    site_url: String(formData.get("site_url") ?? ""),
    status: String(formData.get("status") ?? "ATIVA"),
    recursos_integracao: parseJsonObjectField(
      String(formData.get("recursos_integracao_json") ?? "{}"),
      "recursos_integracao",
    ),
    metadata: {},
  };
}

export type AdministradoraListRow = Administradora & {
  empresas_vinculadas_count: number;
};

export async function fetchAdministradorasGlobaisList(filters?: {
  q?: string;
  status?: string;
}): Promise<AdministradoraListRow[]> {
  await requireGerenciarCatalogoAdministradoras();
  let list = await listAdministradorasGlobaisForSuperadmin();

  const q = (filters?.q ?? "").trim().toLowerCase();
  if (q) {
    list = list.filter(
      (a) =>
        a.nome.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        (a.nome_fantasia ?? "").toLowerCase().includes(q) ||
        (a.cnpj ?? "").includes(q),
    );
  }
  const status = (filters?.status ?? "").trim().toUpperCase();
  if (status === "ATIVA" || status === "INATIVA") {
    list = list.filter((a) => a.status === status);
  }

  const counts = await countEmpresasVinculadasByAdministradoraIds(list.map((a) => a.id));
  return list.map((a) => ({
    ...a,
    empresas_vinculadas_count: counts.get(a.id) ?? 0,
  }));
}

export async function fetchAdministradoraGlobal(id: string) {
  return getAdministradoraGlobalByIdForSuperadmin(id);
}

export async function fetchEmpresasFranqueadasDaAdministradora(id: string) {
  return listEmpresasFranqueadasVinculadas(id);
}

export async function createAdministradoraAction(formData: FormData) {
  await requireGerenciarCatalogoAdministradoras();
  const created = await createAdministradoraGlobal(inputFromForm(formData));
  revalidatePath("/admin/administradoras");
  redirect(`/admin/administradoras/${created.id}`);
}

export async function updateAdministradoraAction(id: string, formData: FormData) {
  await requireGerenciarCatalogoAdministradoras();
  await updateAdministradoraGlobal(id, inputFromForm(formData));
  revalidatePath("/admin/administradoras");
  revalidatePath(`/admin/administradoras/${id}`);
  redirect(`/admin/administradoras/${id}`);
}

export async function setAdministradoraStatusAction(id: string, status: AdministradoraStatus) {
  await requireGerenciarCatalogoAdministradoras();
  await setAdministradoraGlobalStatus(id, status);
  revalidatePath("/admin/administradoras");
  revalidatePath(`/admin/administradoras/${id}`);
}
