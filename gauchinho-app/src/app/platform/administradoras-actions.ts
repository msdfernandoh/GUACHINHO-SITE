"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "VALIDATION_ERROR" | "CONFLICT" | "SERVER_ERROR";
  message: string;
};

async function platformDb() {
  if (!(await isPlatformSuperadmin()))
    throw new Error("Somente Platform Superadmin.");
  return createClient();
}

function stateFrom(error: unknown): PlatformFormState {
  const message =
    error instanceof Error ? error.message : "Erro interno ao salvar.";
  return {
    status: /existe|duplicad|sobrepost|versão/i.test(message)
      ? "CONFLICT"
      : /obrigat|inválid|informe|adicione/i.test(message)
        ? "VALIDATION_ERROR"
        : "SERVER_ERROR",
    message,
  };
}

export async function salvarTipoAdministradoraAction(
  _previous: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  try {
    const administradoraId = String(formData.get("administradora_id") ?? "");
    const nome = String(formData.get("nome") ?? "").trim();
    if (!administradoraId || nome.length < 2)
      return { status: "VALIDATION_ERROR", message: "Informe o nome do Tipo." };
    const db = await platformDb();
    const { error } = await db.rpc("rpc_salvar_tipo_administradora", {
      p_administradora_id: administradoraId,
      p_nome: nome,
      p_ativo: formData.get("ativo") !== "false",
      p_id: String(formData.get("id") ?? "") || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/platform/administradoras/${administradoraId}`);
    return { status: "SUCCESS", message: "Tipo salvo com sucesso." };
  } catch (error) {
    return stateFrom(error);
  }
}

export async function salvarModalidadeAdministradoraAction(
  _previous: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  try {
    const administradoraId = String(formData.get("administradora_id") ?? "");
    const nome = String(formData.get("nome") ?? "").trim();
    if (!administradoraId || nome.length < 2)
      return {
        status: "VALIDATION_ERROR",
        message: "Informe o nome da Modalidade.",
      };
    const db = await platformDb();
    const { error } = await db.rpc("rpc_salvar_modalidade_administradora", {
      p_administradora_id: administradoraId,
      p_nome: nome,
      p_descricao: String(formData.get("descricao") ?? "") || null,
      p_ativo: formData.get("ativo") !== "false",
      p_id: String(formData.get("id") ?? "") || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/platform/administradoras/${administradoraId}`);
    return { status: "SUCCESS", message: "Modalidade salva com sucesso." };
  } catch (error) {
    return stateFrom(error);
  }
}

export async function criarCurvaEstornoAction(
  _previous: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  try {
    const administradoraId = String(formData.get("administradora_id") ?? "");
    const raw = String(formData.get("faixas") ?? "[]");
    let faixas: unknown;
    try {
      faixas = JSON.parse(raw);
    } catch {
      return {
        status: "VALIDATION_ERROR",
        message: "As faixas da curva são inválidas.",
      };
    }
    const db = await platformDb();
    const { error } = await db.rpc("rpc_salvar_curva_estorno", {
      p_administradora_id: administradoraId,
      p_nome: String(formData.get("nome") ?? "").trim(),
      p_vigencia_inicio: String(formData.get("vigencia_inicio") ?? ""),
      p_faixas: faixas,
      p_curva_id: String(formData.get("curva_id") ?? "") || null,
      p_nova_versao: formData.get("nova_versao") === "true",
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/platform/administradoras/${administradoraId}`);
    return {
      status: "SUCCESS",
      message:
        formData.get("nova_versao") === "true"
          ? "Nova versão da curva criada."
          : "Curva salva com sucesso.",
    };
  } catch (error) {
    return stateFrom(error);
  }
}

export async function salvarDadosAdministradoraAction(
  _previous: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  try {
    const id = String(formData.get("administradora_id") ?? "");
    const nome = String(formData.get("nome") ?? "").trim();
    if (!id || !nome)
      return { status: "VALIDATION_ERROR", message: "Nome obrigatório." };
    const db = await platformDb();
    const { error } = await db
      .from("administradoras")
      .update({
        nome,
        nome_fantasia: String(formData.get("nome_fantasia") ?? "") || null,
        status: String(formData.get("status") ?? "ATIVA"),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/platform/administradoras/${id}`);
    return { status: "SUCCESS", message: "Dados gerais salvos." };
  } catch (error) {
    return stateFrom(error);
  }
}
