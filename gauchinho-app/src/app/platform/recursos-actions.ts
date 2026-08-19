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
  const tipo = String(formData.get("tipo") ?? "MODULO_ERP").trim();
  const recursoCodigo = String(formData.get("recurso_codigo") ?? "").trim();
  const efeito = String(formData.get("efeito") ?? "LIBERAR").trim().toUpperCase();
  const valorNumericoRaw = formData.get("valor_numerico");
  const valorNumerico = valorNumericoRaw ? Number(valorNumericoRaw) : null;
  const valorBooleano = formData.get("valor_booleano") === "true";
  const motivo = String(formData.get("motivo") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  const vigenciaInicio = String(formData.get("vigencia_inicio") ?? "").trim() || new Date().toISOString().split("T")[0];
  const vigenciaFim = String(formData.get("vigencia_fim") ?? "").trim() || null;

  if (!empresaId || !recursoCodigo || !motivo) {
    return { status: "ERROR", message: "Master Franquia, Recurso/Limite e Motivo são obrigatórios." };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_criar_override", {
    p_empresa_id: empresaId,
    p_tipo: tipo,
    p_recurso_codigo: recursoCodigo,
    p_efeito: efeito,
    p_valor_numerico: valorNumerico,
    p_valor_booleano: valorBooleano,
    p_motivo: motivo,
    p_observacao: observacao,
    p_vigencia_inicio: vigenciaInicio,
    p_vigencia_fim: vigenciaFim,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/recursos");
  revalidatePath("/platform/overrides");
  revalidatePath(`/platform/empresas/${empresaId}`);
  return { status: "SUCCESS", message: "Override de exceção cadastrado com sucesso.", data };
}

export async function encerrarOverridePlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const motivoEncerramento = String(formData.get("motivo_encerramento") ?? "Encerramento manual via Plataforma").trim();

  if (!id) {
    return { status: "ERROR", message: "ID do override é obrigatório." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_encerrar_override", {
    p_override_id: id,
    p_motivo_encerramento: motivoEncerramento,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/recursos");
  revalidatePath("/platform/overrides");
  return { status: "SUCCESS", message: "Override encerrado com sucesso. Valores restaurados à herança padrão." };
}

