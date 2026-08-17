"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

async function platformDb() {
  if (!(await isPlatformSuperadmin())) throw new Error("Somente Platform Superadmin.");
  return createClient();
}

const path = (grupoId: string) => `/platform/grupos/${grupoId}`;

export async function salvarModalidadesGrupoAction(grupoId: string, formData: FormData) {
  const db = await platformDb();
  const selecionadas = new Set(formData.getAll("modalidades").map(String));
  const { data: grupo, error: grupoError } = await db
    .from("grupos_consorcio").select("administradora_id").eq("id", grupoId).single();
  if (grupoError) throw new Error(grupoError.message);
  const { data: modalidades, error: modalidadesError } = await db
    .from("administradora_modalidades_comissao").select("id")
    .eq("administradora_id", grupo.administradora_id).eq("ativo", true);
  if (modalidadesError) throw new Error(modalidadesError.message);
  for (const [ordem, modalidade] of (modalidades ?? []).entries()) {
    const { error } = await db.from("grupos_modalidades_disponiveis").upsert({
      grupo_id: grupoId,
      administradora_modalidade_id: modalidade.id,
      ativo: selecionadas.has(modalidade.id),
      ordem,
    }, { onConflict: "grupo_id,administradora_modalidade_id" });
    if (error) throw new Error(error.message);
  }
  revalidatePath(path(grupoId)); revalidatePath("/platform/grupos");
}

export async function salvarProdutoAction(grupoId: string, produtoId: string | null, formData: FormData) {
  const db = await platformDb();
  const valorCredito = Number(formData.get("valor_credito"));
  const status = String(formData.get("status") ?? "Disponível").trim();
  if (!Number.isFinite(valorCredito) || valorCredito <= 0) throw new Error("Crédito inválido.");
  let id = produtoId;
  if (id) {
    const { error } = await db.from("grupos_cotas").update({ valor_credito: valorCredito, status, ativo: true }).eq("id", id).eq("grupo_id", grupoId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db.from("grupos_cotas").insert({ grupo_id: grupoId, valor_credito: valorCredito, valor_parcela: 0, status, ativo: true }).select("id").single();
    if (error) throw new Error(error.message); id = data.id;
  }
  const { data: disponiveis, error: disponiveisError } = await db.from("grupos_modalidades_disponiveis")
    .select("administradora_modalidade_id").eq("grupo_id", grupoId).eq("ativo", true);
  if (disponiveisError) throw new Error(disponiveisError.message);
  for (const item of disponiveis ?? []) {
    const raw = String(formData.get(`valor_${item.administradora_modalidade_id}`) ?? "").replace(",", ".");
    const valor = Number(raw);
    if (!Number.isFinite(valor) || valor <= 0) throw new Error("Informe o valor oficial de todas as modalidades habilitadas.");
    const { error } = await db.from("grupo_cota_modalidade_valores").upsert({
      grupo_cota_id: id,
      administradora_modalidade_id: item.administradora_modalidade_id,
      valor_parcela: valor,
      ativo: true,
    }, { onConflict: "grupo_cota_id,administradora_modalidade_id" });
    if (error) throw new Error(error.message);
  }
  revalidatePath(path(grupoId)); revalidatePath("/platform/produtos");
}

export async function inativarProdutoAction(grupoId: string, produtoId: string) {
  const db = await platformDb();
  const { error } = await db.from("grupos_cotas").update({ ativo: false, status: "Inativo" }).eq("id", produtoId).eq("grupo_id", grupoId);
  if (error) throw new Error(error.message);
  revalidatePath(path(grupoId)); revalidatePath("/platform/produtos");
}

