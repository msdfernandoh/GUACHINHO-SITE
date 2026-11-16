"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantPermission } from "@/lib/tenant/context";
import { saveConfigJson } from "@/server/config";
import { normalizarSplConfig, SPL_CONFIG_CHAVE, type SplPortfolioConfig } from "@/lib/spl/config";
import { STATUS_CLIENTE } from "@/lib/spl/types";

async function contexto() {
  const ctx = await requireTenantPermission("gerenciar_imoveis");
  if (!ctx.empresaAtiva) throw new Error("Empresa não selecionada.");
  return { empresaId: ctx.empresaAtiva.id, usuarioId: ctx.usuario.id };
}

const atualizar = () => {
  revalidatePath("/admin/spl");
  revalidatePath("/spl");
};

export async function decidirImobiliariaAction(formData: FormData) {
  const { empresaId, usuarioId } = await contexto();
  const id = String(formData.get("id") ?? "");
  const decisao = String(formData.get("decisao") ?? "");
  const status = decisao === "aprovar" ? "APROVADA" : decisao === "recusar" ? "RECUSADA" : decisao === "inativar" ? "INATIVA" : null;
  if (!id || !status) throw new Error("Decisão inválida.");
  const db = createAdminClient();
  const { data: imob, error } = await db
    .from("spl_imobiliarias")
    .update({
      status,
      exibir_logo: status === "APROVADA",
      aprovado_em: status === "APROVADA" ? new Date().toISOString() : null,
      aprovado_por_usuario_id: status === "APROVADA" ? usuarioId : null,
    })
    .eq("empresa_id", empresaId)
    .eq("id", id)
    .select("organizacao_parceira_id")
    .single();
  if (error) throw new Error(error.message);
  if (imob?.organizacao_parceira_id) {
    await db
      .from("organizacoes_parceiras")
      .update({ status: status === "APROVADA" ? "ATIVA" : "INATIVA" })
      .eq("empresa_id", empresaId)
      .eq("id", imob.organizacao_parceira_id);
  }
  atualizar();
}

export async function alternarLogoAction(formData: FormData) {
  const { empresaId } = await contexto();
  const id = String(formData.get("id") ?? "");
  const exibir = formData.get("exibir") === "true";
  const { error } = await createAdminClient()
    .from("spl_imobiliarias")
    .update({ exibir_logo: exibir })
    .eq("empresa_id", empresaId)
    .eq("id", id);
  if (error) throw new Error(error.message);
  atualizar();
}

export async function statusClienteAction(formData: FormData) {
  const { empresaId } = await contexto();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!STATUS_CLIENTE.some((s) => s.value === status)) throw new Error("Situação inválida.");
  const { error } = await createAdminClient().from("spl_clientes").update({ status }).eq("empresa_id", empresaId).eq("id", id);
  if (error) throw new Error(error.message);
  atualizar();
}

export async function salvarEmpreendimentoAction(formData: FormData) {
  const { empresaId } = await contexto();
  const id = String(formData.get("id") ?? "");
  const n = (k: string) => Math.max(0, Math.floor(Number(String(formData.get(k) ?? "0").replace(/\D/g, "")) || 0));
  const solucoes = formData.getAll("solucoes").map(String);
  const { error } = await createAdminClient()
    .from("spl_empreendimentos")
    .update({
      entrega_texto: String(formData.get("entrega_texto") ?? "").trim() || "—",
      vendidas: n("vendidas"),
      disponiveis: n("disponiveis"),
      solucoes_recomendadas: solucoes,
      ativo: formData.get("ativo") === "on",
    })
    .eq("empresa_id", empresaId)
    .eq("id", id);
  if (error) throw new Error(error.message);
  atualizar();
}

export async function salvarConfigSplAction(formData: FormData) {
  const ctx = await requireTenantPermission("gerenciar_imoveis");
  if (ctx.usuario.perfil !== "master") throw new Error("Somente o master altera as configurações.");
  const raw = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])) as unknown as Partial<SplPortfolioConfig>;
  await saveConfigJson(SPL_CONFIG_CHAVE, normalizarSplConfig(raw) as unknown as Record<string, unknown>);
  atualizar();
}

export async function salvarTermosSplAction(formData: FormData) {
  const ctx = await requireTenantPermission("gerenciar_imoveis");
  if (ctx.usuario.perfil !== "master") throw new Error("Somente o master publica o termo.");
  const { novaVersaoTermos, SPL_TERMOS_CHAVE } = await import("@/lib/spl/termos");
  const { CAMPOS_TERMO, MODELOS_COM_TERMO } = await import("@/lib/spl/termos-preencher");
  const modelos: Record<string, string> = {};
  for (const m of MODELOS_COM_TERMO) {
    const t = String(formData.get(`modelo_${m}`) ?? "").replace(/\r\n/g, "\n").trim().slice(0, 100_000);
    if (t) modelos[m] = t;
  }
  const campos: Record<string, string> = {};
  for (const c of CAMPOS_TERMO) campos[c.chave] = String(formData.get(`campo_${c.chave}`) ?? "").trim().slice(0, 300);
  await saveConfigJson(SPL_TERMOS_CHAVE, { versao: novaVersaoTermos(), modelos, campos, atualizado_em: new Date().toISOString() });
  atualizar();
  revalidatePath("/spl/cadastro");
}

/** Exclui a imobiliária com vendedores e clientes da carteira SPL (os leads do CRM ficam). */
export async function excluirImobiliariaAction(formData: FormData) {
  const ctx = await requireTenantPermission("gerenciar_imoveis");
  if (ctx.usuario.perfil !== "master") throw new Error("Somente o master exclui imobiliárias.");
  const empresaId = ctx.empresaAtiva!.id;
  const id = String(formData.get("id") ?? "");
  const db = createAdminClient();
  const { data: imob } = await db
    .from("spl_imobiliarias")
    .select("id,organizacao_parceira_id")
    .eq("empresa_id", empresaId)
    .eq("id", id)
    .maybeSingle();
  if (!imob) throw new Error("Imobiliária não encontrada.");
  const { error } = await db.from("spl_imobiliarias").delete().eq("empresa_id", empresaId).eq("id", id);
  if (error) throw new Error(error.message);
  if (imob.organizacao_parceira_id) {
    // Rascunho criado pelo cadastro; se já estiver em uso em outro lugar, o banco recusa e ele fica.
    await db.from("organizacoes_parceiras").delete().eq("empresa_id", empresaId).eq("id", imob.organizacao_parceira_id);
  }
  atualizar();
}
