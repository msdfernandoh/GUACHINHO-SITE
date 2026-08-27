"use server";

import { revalidatePath } from "next/cache";
import { criarUrlTabelaGrupo, uploadTabelaGrupo } from "@/lib/grupos/grupo-tabela.server";

export type GrupoTabelaActionResult =
  | { ok: true; message: string; uploaded_at?: string; url?: string }
  | { ok: false; error: string };

export async function uploadTabelaGrupoAction(
  grupoId: string,
  origemPortal: "SITE" | "ERP",
  formData: FormData,
): Promise<GrupoTabelaActionResult> {
  try {
    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File)) return { ok: false, error: "Selecione uma tabela para enviar." };
    const tabela = await uploadTabelaGrupo(grupoId, origemPortal, arquivo);
    revalidatePath("/admin/grupos");
    revalidatePath(`/admin/grupos/${grupoId}`);
    revalidatePath("/erp/grupos");
    revalidatePath(`/erp/grupos/${grupoId}`);
    return { ok: true, message: "Tabela substituída e compartilhada entre Site e ERP.", uploaded_at: tabela.uploaded_at };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao enviar a tabela." };
  }
}

export async function visualizarTabelaGrupoAction(grupoId: string): Promise<GrupoTabelaActionResult> {
  try {
    const { url } = await criarUrlTabelaGrupo(grupoId);
    return { ok: true, message: "Tabela pronta para visualização.", url };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao abrir a tabela." };
  }
}
