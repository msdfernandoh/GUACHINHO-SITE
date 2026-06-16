"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canEditSettings } from "@/lib/auth/permissions";
import {
  listIndicesFinanceiros,
  updateIndiceFinanceiro,
  type UpdateIndiceInput,
} from "@/lib/indices-financeiros/repository";
import { refreshIndiceAutomatico, refreshTodosAutomaticos } from "@/lib/indices-financeiros/refresh";

async function requireMaster() {
  const usuario = await getUsuarioNegocio();
  if (!canEditSettings(usuario?.perfil)) {
    throw new Error("Sem permissão");
  }
  return usuario;
}

export async function fetchIndicesAdmin() {
  await requireMaster();
  return listIndicesFinanceiros();
}

export async function saveIndiceAdmin(input: UpdateIndiceInput) {
  await requireMaster();
  await updateIndiceFinanceiro(input);
  revalidatePath("/admin/indices-financeiros");
  revalidatePath("/calculadoras");
}

export async function atualizarIndiceAgora(codigo: string) {
  await requireMaster();
  const result = await refreshIndiceAutomatico(codigo);
  revalidatePath("/admin/indices-financeiros");
  revalidatePath("/calculadoras");
  return result;
}

export async function atualizarTodosIndicesAutomaticos() {
  await requireMaster();
  const results = await refreshTodosAutomaticos();
  revalidatePath("/admin/indices-financeiros");
  revalidatePath("/calculadoras");
  return results;
}
