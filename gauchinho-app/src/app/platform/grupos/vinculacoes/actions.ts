"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { vincularGrupoLegado, type ProdutoMapeado } from "@/lib/platform/vinculacoes-legadas-service";
import { requireTenantPermission } from "@/lib/tenant/context";

async function exigirPermissaoAtualizacaoCatalogo() {
  if (await isPlatformSuperadmin()) return;
  await requireTenantPermission("gerenciar_grupos");
}

export async function atualizarVisualizacaoCatalogoAction() {
  try {
    await exigirPermissaoAtualizacaoCatalogo();

    revalidatePath("/grupos");
    revalidatePath("/simulador");
    revalidatePath("/");
    revalidatePath("/erp/grupos");
    revalidatePath("/erp/contratacoes");
    revalidatePath("/erp/clientes");
    revalidatePath("/platform/grupos");
    revalidatePath("/platform/grupos/vinculacoes");

    return {
      ok: true,
      mensagem:
        "Visualização atualizada com os dados já cadastrados no catálogo SaaS. Nenhuma administradora externa foi consultada.",
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro ao atualizar a visualização do catálogo." };
  }
}

/** Compatibilidade temporária para consumidores antigos. Esta ação não executa integração externa. */
export async function sincronizarCatalogoSiteErpAction() {
  return atualizarVisualizacaoCatalogoAction();
}

export async function vincularGrupoLegadoAction(formData: FormData) {
  const empresa_id = String(formData.get("empresa_id") || "").trim();
  const origem = String(formData.get("origem") || "site_grupos").trim();
  const identificador_legado = String(formData.get("identificador_legado") || "").trim();
  const grupo_consorcio_id = String(formData.get("grupo_consorcio_id") || "").trim();
  const produtos_mapeamento_raw = String(formData.get("produtos_mapeamento") || "[]");
  const observacoes = String(formData.get("observacoes") || "").trim();

  if (!empresa_id) {
    return { ok: false, error: "Empresa alvo não informada." };
  }
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
    if (!(await isPlatformSuperadmin())) {
      return { ok: false, error: "Apenas administradores da plataforma podem vincular grupos legados." };
    }

    const res = await vincularGrupoLegado({
      empresa_id,
      origem,
      identificador_legado,
      grupo_consorcio_id,
      produtos_mapeamento,
      atualizar_contratacoes: true,
      observacoes: observacoes || undefined,
    });

    revalidatePath("/platform/grupos/vinculacoes");
    revalidatePath("/platform/grupos");
    revalidatePath("/grupos");
    revalidatePath("/simulador");
    revalidatePath("/");
    revalidatePath("/erp/grupos");
    revalidatePath("/erp/contratacoes");
    revalidatePath("/erp/clientes");

    return { ok: true, data: res };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro ao vincular grupo legado." };
  }
}
