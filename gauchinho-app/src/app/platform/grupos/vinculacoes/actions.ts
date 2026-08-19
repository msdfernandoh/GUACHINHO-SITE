"use server";

import { revalidatePath } from "next/cache";
import { vincularGrupoLegado, type ProdutoMapeado } from "@/lib/platform/vinculacoes-legadas-service";

export async function vincularGrupoLegadoAction(formData: FormData) {
  const origem = String(formData.get("origem") || "site_grupos").trim();
  const identificador_legado = String(formData.get("identificador_legado") || "").trim();
  const grupo_consorcio_id = String(formData.get("grupo_consorcio_id") || "").trim();
  const produtos_mapeamento_raw = String(formData.get("produtos_mapeamento") || "[]");
  const observacoes = String(formData.get("observacoes") || "").trim();

  if (!identificador_legado) {
    return { ok: false, error: "Identificador legado não informado." };
  }
  if (!grupo_consorcio_id) {
    return { ok: false, error: "Grupo SaaS canônico não selecionado." };
  }

  let produtos_mapeamento: ProdutoMapeado[] = [];
  try {
    produtos_mapeamento = JSON.parse(produtos_mapeamento_raw);
  } catch {
    produtos_mapeamento = [];
  }

  try {
    const res = await vincularGrupoLegado({
      origem,
      identificador_legado,
      grupo_consorcio_id,
      produtos_mapeamento,
      atualizar_contratacoes: true,
      observacoes: observacoes || undefined
    });

    revalidatePath("/platform/grupos/vinculacoes");
    revalidatePath("/platform/grupos");
    revalidatePath("/erp/grupos");
    revalidatePath("/erp/contratacoes");
    revalidatePath("/erp/clientes");

    return { ok: true, data: res };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro ao vincular grupo legado." };
  }
}
