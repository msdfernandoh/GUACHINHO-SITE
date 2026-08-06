"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import {
  validateBrandingPublishInput,
  validateDominioCreateInput,
  validateEmpresaStatusInput,
} from "@/lib/tenant/admin-action-guards";
import { invalidateTenantHostCache } from "@/lib/tenant/tenant-host-cache";
import type { Empresa } from "@/lib/tenant/context";
import type { EmpresaBranding } from "@/lib/tenant/branding";

export type EmpresaDominioRow = {
  id: string;
  empresa_id: string;
  tipo: "DOMINIO_CUSTOMIZADO" | "SUBDOMINIO";
  valor: string;
  principal: boolean;
  ativo: boolean;
  verificado: boolean;
};

async function requireSuperadmin() {
  const ok = await isPlatformSuperadmin();
  if (!ok) throw new Error("Apenas SuperAdmins da plataforma podem gerenciar empresas.");
}

export async function fetchEmpresasList(): Promise<Empresa[]> {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("empresas").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Empresa[];
}

export async function fetchEmpresaComDetalhes(id: string) {
  await requireSuperadmin();
  const supabase = await createClient();

  const [{ data: empresa, error: empresaError }, { data: branding }, { data: dominios }] =
    await Promise.all([
      supabase.from("empresas").select("*").eq("id", id).single(),
      supabase.from("empresa_branding").select("*").eq("empresa_id", id).maybeSingle(),
      supabase
        .from("empresa_dominios")
        .select("*")
        .eq("empresa_id", id)
        .order("principal", { ascending: false })
        .order("created_at"),
    ]);

  if (empresaError) throw new Error(empresaError.message);

  return {
    empresa: empresa as Empresa,
    branding: (branding ?? null) as EmpresaBranding | null,
    dominios: (dominios ?? []) as EmpresaDominioRow[],
  };
}

export async function updateEmpresaStatusAction(id: string, formData: FormData) {
  await requireSuperadmin();
  const validated = validateEmpresaStatusInput(String(formData.get("status") ?? "em_treinamento"));
  if (!validated.ok) throw new Error(validated.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("empresas")
    .update({ status: validated.status, ativo: validated.ativo })
    .eq("id", id);
  if (error) throw new Error(error.message);

  invalidateTenantHostCache();
  revalidatePath("/admin/empresas");
  revalidatePath(`/admin/empresas/${id}`);
}

export async function upsertBrandingAction(id: string, formData: FormData) {
  await requireSuperadmin();
  const supabase = await createClient();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("status, ativo")
    .eq("id", id)
    .single();

  const statusPublicacao = String(formData.get("status_publicacao") ?? "RASCUNHO");
  const nomeSite = String(formData.get("nome_site") ?? "").trim();
  const validated = validateBrandingPublishInput({
    nomeSite,
    statusPublicacao,
    empresaStatus: empresa?.status,
    empresaAtivo: empresa?.ativo,
  });
  if (!validated.ok) throw new Error(validated.error);

  const payload = {
    empresa_id: id,
    nome_site: nomeSite,
    subtitulo: String(formData.get("subtitulo") ?? "").trim(),
    descricao_institucional: String(formData.get("descricao_institucional") ?? "").trim(),
    cor_primaria: String(formData.get("cor_primaria") ?? "").trim() || null,
    cor_secundaria: String(formData.get("cor_secundaria") ?? "").trim() || null,
    cor_destaque: String(formData.get("cor_destaque") ?? "").trim() || null,
    telefone: String(formData.get("telefone") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim(),
    email_contato: String(formData.get("email_contato") ?? "").trim(),
    status_publicacao: validated.statusPublicacao,
  };

  const { error } = await supabase
    .from("empresa_branding")
    .upsert(payload, { onConflict: "empresa_id" });
  if (error) throw new Error(error.message);

  invalidateTenantHostCache();
  revalidatePath(`/admin/empresas/${id}`);
}

export async function createDominioAction(empresaId: string, formData: FormData) {
  await requireSuperadmin();
  const supabase = await createClient();

  const validated = validateDominioCreateInput({
    tipo: String(formData.get("tipo") ?? "DOMINIO_CUSTOMIZADO"),
    valorRaw: String(formData.get("valor") ?? ""),
  });
  if (!validated.ok) throw new Error(validated.error);

  const principal = formData.get("principal") === "on";

  const { error } = await supabase.from("empresa_dominios").insert({
    empresa_id: empresaId,
    tipo: validated.tipo,
    valor: validated.valor,
    principal,
    ativo: true,
    verificado: false,
  });
  if (error) {
    if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
      throw new Error("Domínio já cadastrado para outra empresa ou registro ativo.");
    }
    throw new Error(error.message);
  }

  invalidateTenantHostCache();
  revalidatePath(`/admin/empresas/${empresaId}`);
}

export async function verifyDominioAction(dominioId: string, empresaId: string) {
  await requireSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("empresa_dominios")
    .update({ verificado: true })
    .eq("id", dominioId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);

  invalidateTenantHostCache();
  revalidatePath(`/admin/empresas/${empresaId}`);
}

export async function deleteDominioAction(dominioId: string, empresaId: string) {
  await requireSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase.from("empresa_dominios").delete().eq("id", dominioId);
  if (error) throw new Error(error.message);

  invalidateTenantHostCache();
  revalidatePath(`/admin/empresas/${empresaId}`);
}
