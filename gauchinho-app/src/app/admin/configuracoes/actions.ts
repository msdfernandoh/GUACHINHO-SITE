"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canEditSettings } from "@/lib/auth/permissions";
import { saveConfigJson } from "@/server/config";

async function requireMasterConfig() {
  const u = await requireUsuario();
  if (!canEditSettings(u.perfil)) throw new Error("Sem permissão");
  return u;
}

export async function saveSiteConfigAction(formData: FormData) {
  await requireMasterConfig();
  await saveConfigJson("site", {
    nomeEmpresa: String(formData.get("nomeEmpresa") ?? ""),
    subtitulo: String(formData.get("subtitulo") ?? ""),
    descricaoInstitucional: String(formData.get("descricaoInstitucional") ?? ""),
    siteUrl: String(formData.get("siteUrl") ?? ""),
    statusAtivo: formData.get("statusAtivo") === "on",
    exibirBotaoGruposNoSite: formData.get("exibirBotaoGruposNoSite") === "on",
  });
  revalidatePath("/admin/configuracoes");
}

export async function saveContatoConfigAction(formData: FormData) {
  await requireMasterConfig();
  await saveConfigJson("contato", {
    whatsappPrincipal: String(formData.get("whatsappPrincipal") ?? ""),
    telefone: String(formData.get("telefone") ?? ""),
    email: String(formData.get("email") ?? ""),
    endereco: String(formData.get("endereco") ?? ""),
    instagram: String(formData.get("instagram") ?? ""),
  });
  revalidatePath("/admin/configuracoes");
}

export async function savePropostasConfigAction(formData: FormData) {
  await requireMasterConfig();
  await saveConfigJson("propostas", {
    validadePadraoDias: Number(formData.get("validadePadraoDias") ?? 7),
    textoResumoExecutivo: String(formData.get("textoResumoExecutivo") ?? ""),
    avisoLegalPadrao: String(formData.get("avisoLegalPadrao") ?? ""),
  });
  revalidatePath("/admin/configuracoes");
}

export async function saveLeadsConfigAction(formData: FormData) {
  await requireMasterConfig();
  await saveConfigJson("leads", {
    statusInicialPadrao: String(formData.get("statusInicialPadrao") ?? "Novo"),
    permitirCriarLeadManual: formData.get("permitirCriarLeadManual") === "on",
    permitirArquivarLead: formData.get("permitirArquivarLead") === "on",
    srdPodeEditarGrupos: formData.get("srdPodeEditarGrupos") === "on",
  });
  revalidatePath("/admin/configuracoes");
}

function numField(formData: FormData, name: string, fallback = 0) {
  const v = Number(formData.get(name));
  return Number.isFinite(v) ? v : fallback;
}

function prazosFromForm(formData: FormData, name: string): number[] {
  const raw = String(formData.get(name) ?? "");
  return raw
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function simuladorPayloadFromForm(formData: FormData) {
  return {
    taxaAdministrativaPadrao: numField(formData, "taxaAdministrativaPadrao"),
    fundoReservaPadrao: numField(formData, "fundoReservaPadrao"),
    seguroPrestamistaPadrao: numField(formData, "seguroPrestamistaPadrao"),
    reajusteAnualCredito: numField(formData, "reajusteAnualCredito"),
    correcaoAnualParcela: numField(formData, "correcaoAnualParcela"),
    rentabilidadeAnualComparativa: numField(formData, "rentabilidadeAnualComparativa"),
    valorMinimoCredito: numField(formData, "valorMinimoCredito"),
    valorMaximoCredito: numField(formData, "valorMaximoCredito"),
    valorPadraoInicial: numField(formData, "valorPadraoInicial"),
    prazosDisponiveis: prazosFromForm(formData, "prazosDisponiveis"),
    prazoPadrao: numField(formData, "prazoPadrao"),
    quantidadePrazosExibidos: numField(formData, "quantidadePrazosExibidos", 5),
    mostrarComparacaoFinanciamento: formData.get("mostrarComparacaoFinanciamento") === "on",
    mostrarTabelaAnoAno: formData.get("mostrarTabelaAnoAno") === "on",
    exibirTabelaCompletaPorPadrao: formData.get("exibirTabelaCompletaPorPadrao") === "on",
  };
}

export async function saveSimuladorImovelConfigAction(formData: FormData) {
  await requireMasterConfig();
  await saveConfigJson("simulador_imovel", simuladorPayloadFromForm(formData));
  revalidatePath("/admin/configuracoes");
  revalidatePath("/simulador");
}

export async function saveSimuladorAutomovelConfigAction(formData: FormData) {
  await requireMasterConfig();
  await saveConfigJson("simulador_automovel", simuladorPayloadFromForm(formData));
  revalidatePath("/admin/configuracoes");
  revalidatePath("/simulador");
}

export async function saveFinanciamentoConfigAction(formData: FormData) {
  await requireMasterConfig();
  await saveConfigJson("financiamento_config", {
    taxaMensalPadrao: numField(formData, "taxaMensalPadrao"),
    entradaMinimaSugeridaPercentual: numField(formData, "entradaMinimaSugeridaPercentual"),
    prazoPadrao: numField(formData, "prazoPadrao"),
    prazoMaximo: numField(formData, "prazoMaximo"),
    indiceReajusteOpcional: numField(formData, "indiceReajusteOpcional"),
    parceiroPadrao: String(formData.get("parceiroPadrao") ?? ""),
    mostrarComparacaoConsorcio: formData.get("mostrarComparacaoConsorcio") === "on",
  });
  revalidatePath("/admin/configuracoes");
  revalidatePath("/simulador");
}

export async function fetchWhatsappOrigens() {
  const supabase = await createClient();
  const { data } = await supabase.from("whatsapp_origens").select("*").order("origem");
  return data ?? [];
}

export async function saveWhatsappOrigemAction(formData: FormData) {
  await requireMasterConfig();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const payload = {
    origem: String(formData.get("origem") ?? "").trim(),
    ativo: formData.get("ativo") === "on",
    exibir_botao_apos_lead: formData.get("exibir_botao_apos_lead") === "on",
    nome_atendimento: String(formData.get("nome_atendimento") ?? "").trim() || null,
    whatsapp_destino: String(formData.get("whatsapp_destino") ?? "").trim() || null,
    mensagem_padrao: String(formData.get("mensagem_padrao") ?? "").trim() || null,
    usar_whatsapp_principal_fallback: formData.get("usar_whatsapp_principal_fallback") === "on",
  };
  if (id) {
    await supabase.from("whatsapp_origens").update(payload).eq("id", id);
  } else {
    await supabase.from("whatsapp_origens").insert(payload);
  }
  revalidatePath("/admin/configuracoes");
}

export async function deleteWhatsappOrigemAction(id: string) {
  await requireMasterConfig();
  const supabase = await createClient();
  await supabase.from("whatsapp_origens").delete().eq("id", id);
  revalidatePath("/admin/configuracoes");
}

export async function fetchAllConfigsForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("configuracoes_sistema").select("chave, valor");
  const map: Record<string, Record<string, unknown>> = {};
  (data ?? []).forEach((row) => {
    map[row.chave] = row.valor as Record<string, unknown>;
  });
  return map;
}
