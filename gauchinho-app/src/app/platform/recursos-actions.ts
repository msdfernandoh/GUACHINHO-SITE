"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

export async function salvarOverridePlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const recursoCodigo = String(formData.get("recurso_codigo") ?? "").trim();
  const efeito = String(formData.get("efeito") ?? "LIBERAR").trim().toUpperCase();
  const motivo = String(formData.get("motivo") ?? "").trim();
  const vigenciaInicio = String(formData.get("vigencia_inicio") ?? "").trim() || new Date().toISOString().split("T")[0];
  const vigenciaFim = String(formData.get("vigencia_fim") ?? "").trim() || null;

  if (!empresaId || !recursoCodigo || !motivo) {
    return { status: "ERROR", message: "Empresa, Código do Recurso e Motivo são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.from("saas_empresa_overrides").insert({
    empresa_id: empresaId,
    recurso_codigo: recursoCodigo,
    efeito,
    motivo,
    vigencia_inicio: vigenciaInicio,
    vigencia_fim: vigenciaFim,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/recursos");
  revalidatePath(`/platform/empresas/${empresaId}`);
  return { status: "SUCCESS", message: "Override de recurso cadastrado com sucesso." };
}

export async function excluirOverridePlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { status: "ERROR", message: "ID do override é obrigatório." };
  }

  const db = await createClient();
  const { error } = await db.from("saas_empresa_overrides").delete().eq("id", id);

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/recursos");
  return { status: "SUCCESS", message: "Override removido com sucesso." };
}
