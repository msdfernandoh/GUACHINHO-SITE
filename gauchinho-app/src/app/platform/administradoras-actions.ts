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
    const { error } = await db.rpc("rpc_platform_salvar_curva_estorno", {
      p_administradora_id: administradoraId,
      p_nome: String(formData.get("nome") ?? "").trim(),
      p_descricao: String(formData.get("descricao") ?? "") || null,
      p_status: String(formData.get("status") ?? "RASCUNHO"),
      p_vigencia_inicio: String(formData.get("vigencia_inicio") ?? ""),
      p_vigencia_fim: String(formData.get("vigencia_fim") ?? "") || null,
      p_faixas: faixas,
      p_todos_tipos: formData.get("tipos_aplicabilidade") !== "SELECIONADOS",
      p_tipos: formData.getAll("curva_tipo_id").map(String),
      p_todas_modalidades:
        formData.get("modalidades_aplicabilidade") !== "SELECIONADAS",
      p_modalidades: formData.getAll("curva_modalidade_id").map(String),
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
    const id = String(formData.get("administradora_id") ?? "") || null;
    const nome = String(formData.get("nome") ?? "").trim();
    if (!nome)
      return { status: "VALIDATION_ERROR", message: "Nome obrigatório." };
    const db = await platformDb();
    const { data, error } = await db.rpc("rpc_platform_salvar_administradora", {
      p_id: id,
      p_nome: nome,
      p_nome_fantasia: String(formData.get("nome_fantasia") ?? "") || null,
      p_status: String(formData.get("status") ?? "ATIVA"),
      p_descricao: String(formData.get("descricao_institucional") ?? "") || null,
    });
    if (error) throw new Error(error.message);
    const saved = data as { id?: string } | null;
    revalidatePath("/platform/administradoras");
    if (saved?.id) revalidatePath(`/platform/administradoras/${saved.id}`);
    return { status: "SUCCESS", message: id ? "Dados gerais salvos." : "Administradora criada com sucesso." };
  } catch (error) {
    return stateFrom(error);
  }
}

async function rpcState(rpc: string, args: Record<string, unknown>, success: string, administradoraId?: string): Promise<PlatformFormState> {
  try {
    const db = await platformDb();
    const { error } = await db.rpc(rpc, args);
    if (error) throw new Error(error.message);
    revalidatePath("/platform/administradoras");
    if (administradoraId) revalidatePath(`/platform/administradoras/${administradoraId}`);
    return { status: "SUCCESS", message: success };
  } catch (error) { return stateFrom(error); }
}

export async function excluirAdministradoraAction(_previous: PlatformFormState, formData: FormData) {
  return rpcState("rpc_platform_excluir_administradora", { p_id: String(formData.get("id") ?? "") }, "Administradora excluída.");
}

export async function excluirTipoAdministradoraAction(_previous: PlatformFormState, formData: FormData) {
  return rpcState("rpc_platform_excluir_tipo_administradora", { p_id: String(formData.get("id") ?? "") }, "Tipo excluído.", String(formData.get("administradora_id") ?? ""));
}

export async function excluirModalidadeAdministradoraAction(_previous: PlatformFormState, formData: FormData) {
  return rpcState("rpc_platform_excluir_modalidade_administradora", { p_id: String(formData.get("id") ?? "") }, "Modalidade excluída.", String(formData.get("administradora_id") ?? ""));
}

export async function configurarModalidadeTiposAction(_previous: PlatformFormState, formData: FormData) {
  return rpcState("rpc_platform_configurar_modalidade_tipos", {
    p_modalidade_id: String(formData.get("modalidade_id") ?? ""),
    p_todos: formData.get("aplicabilidade") !== "SELECIONADOS",
    p_tipos: formData.getAll("tipo_id").map(String),
  }, "Aplicabilidade da Modalidade salva.", String(formData.get("administradora_id") ?? ""));
}

export async function excluirCurvaEstornoAction(_previous: PlatformFormState, formData: FormData) {
  return rpcState("rpc_platform_excluir_curva_estorno", { p_id: String(formData.get("id") ?? "") }, "Curva excluída.", String(formData.get("administradora_id") ?? ""));
}

export async function salvarModeloMasterAction(_previous: PlatformFormState, formData: FormData) {
  const modalidadeIds = formData.getAll("modalidade_id").map(String);
  const modalidades = modalidadeIds.map((modalidadeId) => ({
    modalidade_id: modalidadeId,
    regra_id: String(formData.get(`regra_${modalidadeId}`) ?? "") || null,
  }));
  return rpcState("rpc_platform_salvar_modelo_comissao", {
    p_administradora_id: String(formData.get("administradora_id") ?? ""),
    p_tipo_id: String(formData.get("tipo_id") ?? ""),
    p_nome: String(formData.get("nome") ?? ""),
    p_descricao: String(formData.get("descricao") ?? "") || null,
    p_percentual: Number(String(formData.get("percentual") ?? "0").replace(",", ".")),
    p_modalidades: modalidades,
    p_id: String(formData.get("id") ?? "") || null,
    p_nova_versao: formData.get("nova_versao") === "true",
  }, "Modelo Master salvo.", String(formData.get("administradora_id") ?? ""));
}

export async function statusModeloMasterAction(_previous: PlatformFormState, formData: FormData) {
  return rpcState("rpc_platform_status_modelo_comissao", {
    p_id: String(formData.get("id") ?? ""),
    p_status: String(formData.get("status") ?? "INATIVO"),
  }, "Status do Modelo Master atualizado.", String(formData.get("administradora_id") ?? ""));
}

export async function configurarCurvaRegraAction(_previous: PlatformFormState, formData: FormData) {
  return rpcState("rpc_platform_configurar_curva_regra", {
    p_regra_id: String(formData.get("regra_id") ?? ""),
    p_curva_id: String(formData.get("curva_id") ?? "") || null,
  }, "Curva opcional da regra atualizada.", String(formData.get("administradora_id") ?? ""));
}

export async function statusProgramaAction(_previous: PlatformFormState, formData: FormData) {
  const status = String(formData.get("status") ?? "INATIVO");
  const successMsg =
    status === "ATIVO"
      ? "Versão homologada com sucesso."
      : "Status do Programa atualizado.";
  return rpcState(
    "rpc_platform_status_programa",
    {
      p_programa_id: String(formData.get("programa_id") ?? ""),
      p_status: status,
    },
    successMsg,
    String(formData.get("administradora_id") ?? ""),
  );
}

export async function novaVersaoProgramaAction(_previous: PlatformFormState, formData: FormData) {
  return rpcState("rpc_platform_nova_versao_programa", {
    p_programa_id: String(formData.get("programa_id") ?? ""),
  }, "Nova versão do Programa criada em rascunho.", String(formData.get("administradora_id") ?? ""));
}

export async function excluirProgramaAction(_previous: PlatformFormState, formData: FormData) {
  return rpcState("rpc_platform_excluir_programa", {
    p_programa_id: String(formData.get("programa_id") ?? ""),
  }, "Programa sem uso excluído.", String(formData.get("administradora_id") ?? ""));
}

export async function alternarAdministradoraAction(formData: FormData): Promise<void> {
  const db = await platformDb();
  const id = String(formData.get("id") ?? "");
  const { error } = await db.rpc("rpc_platform_salvar_administradora", {
    p_id: id,
    p_nome: String(formData.get("nome") ?? ""),
    p_nome_fantasia: String(formData.get("nome_fantasia") ?? "") || null,
    p_status: String(formData.get("status") ?? "INATIVA"),
    p_descricao: String(formData.get("descricao_institucional") ?? "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/platform/administradoras");
  revalidatePath(`/platform/administradoras/${id}`);
}
