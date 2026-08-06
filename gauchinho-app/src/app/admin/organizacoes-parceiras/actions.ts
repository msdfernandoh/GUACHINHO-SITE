"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { requireGerenciarOrganizacoes } from "@/lib/parceiros/authorization";
import {
  fase3AdminDisabledMessage,
  isFase3ParticipantesSchemaReady,
} from "@/lib/parceiros/schema-ready";
import {
  validateCnpjUnicoNoTenant,
  validateOrganizacaoCreateInput,
} from "@/lib/parceiros/rules";
import { normalizeCnpj, normalizeEmail } from "@/lib/parceiros/normalize";
import type { OrganizacaoParceira } from "@/lib/parceiros/types";

async function resolveEmpresaIdPadrao(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", "gauchinho")
    .single();
  if (error || !data) throw new Error("Empresa Gauchinho não encontrada.");
  return data.id as string;
}

async function assertAdminAccess(empresaId: string) {
  const ready = await isFase3ParticipantesSchemaReady();
  if (!ready) throw new Error(fase3AdminDisabledMessage());
  await requireGerenciarOrganizacoes(empresaId);
}

export async function fetchOrganizacoesList(filters?: {
  status?: string;
  q?: string;
}): Promise<{
  ready: boolean;
  message?: string;
  rows: OrganizacaoParceira[];
  empresaId: string | null;
}> {
  const ready = await isFase3ParticipantesSchemaReady();
  if (!ready) {
    return { ready: false, message: fase3AdminDisabledMessage(), rows: [], empresaId: null };
  }

  const empresaId = await resolveEmpresaIdPadrao();
  await requireGerenciarOrganizacoes(empresaId);

  const supabase = await createClient();
  let query = supabase
    .from("organizacoes_parceiras")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    query = query.or(`nome_fantasia.ilike.%${q}%,cnpj.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { ready: true, rows: (data ?? []) as OrganizacaoParceira[], empresaId };
}

export async function createOrganizacaoAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertAdminAccess(empresaId);

  const input = {
    empresaId,
    tipo: String(formData.get("tipo") ?? ""),
    nomeFantasia: String(formData.get("nome_fantasia") ?? ""),
    status: String(formData.get("status") ?? "RASCUNHO"),
    telefone: String(formData.get("telefone") ?? "") || null,
    whatsapp: String(formData.get("whatsapp") ?? "") || null,
    cnpj: String(formData.get("cnpj") ?? "") || null,
  };

  const validated = validateOrganizacaoCreateInput(input);
  if (!validated.ok) throw new Error(validated.error);

  const supabase = await createClient();
  const cnpjNorm = normalizeCnpj(input.cnpj);
  if (cnpjNorm) {
    const { data: existing } = await supabase
      .from("organizacoes_parceiras")
      .select("id, empresa_id, cnpj")
      .eq("empresa_id", empresaId)
      .not("cnpj", "is", null);
    const uniq = validateCnpjUnicoNoTenant({
      empresaId,
      cnpj: cnpjNorm,
      existing: (existing ?? []).map((o) => ({
        id: o.id,
        empresaId: o.empresa_id,
        cnpj: o.cnpj,
      })),
    });
    if (!uniq.ok) throw new Error(uniq.error);
  }

  const regioesRaw = String(formData.get("regioes_atuacao") ?? "").trim();
  const regioes = regioesRaw
    ? regioesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const { error } = await supabase.from("organizacoes_parceiras").insert({
    empresa_id: empresaId,
    tipo: input.tipo,
    nome_fantasia: input.nomeFantasia.trim(),
    razao_social: String(formData.get("razao_social") ?? "") || null,
    cnpj: cnpjNorm,
    status: input.status,
    telefone: input.telefone,
    whatsapp: input.whatsapp,
    email: normalizeEmail(String(formData.get("email") ?? "") || null),
    site: String(formData.get("site") ?? "") || null,
    instagram: String(formData.get("instagram") ?? "") || null,
    descricao: String(formData.get("descricao") ?? "") || null,
    cidade: String(formData.get("cidade") ?? "") || null,
    estado: String(formData.get("estado") ?? "") || null,
    cep: String(formData.get("cep") ?? "") || null,
    endereco: String(formData.get("endereco") ?? "") || null,
    regioes_atuacao: regioes,
    observacoes: String(formData.get("observacoes") ?? "") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/organizacoes-parceiras");
}

export async function updateOrganizacaoStatusAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertAdminAccess(empresaId);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const validated = validateOrganizacaoCreateInput({
    empresaId,
    tipo: "PARCEIRO_COMERCIAL",
    nomeFantasia: "x",
    status,
    telefone: "1",
  });
  if (!validated.ok) throw new Error(validated.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizacoes_parceiras")
    .update({ status })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/organizacoes-parceiras");
}

export async function canAccessOrganizacoesAdmin(): Promise<boolean> {
  if (await isPlatformSuperadmin()) return true;
  try {
    const empresaId = await resolveEmpresaIdPadrao();
    await requireGerenciarOrganizacoes(empresaId);
    return true;
  } catch {
    return false;
  }
}
