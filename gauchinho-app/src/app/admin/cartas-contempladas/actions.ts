"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { parseBrazilianNumber } from "@/lib/utils/format";
import type { CartaStatus, CartaTipo } from "@/lib/cartas/types";
import { CARTA_STATUS } from "@/lib/cartas/types";
import {
  isMissingCartaAdministradoraIdColumn,
  resolveCartaAdministradora,
  withoutCartaAdministradoraId,
} from "@/lib/cartas/administradora";
import { registrarEvento } from "@/lib/eventos/registrar";
import {
  enrichPropostaProjecaoFromSimulacao,
  generateAndStorePropostaPdf,
} from "@/lib/proposta/generate-pdf";

function numForm(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const n = parseBrazilianNumber(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function intForm(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function cartaFromForm(formData: FormData) {
  const tipo = String(formData.get("tipo_carta") ?? "imovel").trim() as CartaTipo;
  const status = String(formData.get("status") ?? "consultar_disponibilidade").trim() as CartaStatus;
  if (!CARTA_STATUS.includes(status)) throw new Error("Status inválido");

  const admin = createAdminClient();
  const { data: administradoras, error: administradorasError } = await admin
    .from("administradoras")
    .select("id, nome, nome_fantasia, razao_social, status");
  if (administradorasError) throw new Error("Não foi possível validar a administradora.");
  const administradora = resolveCartaAdministradora(
    {
      administradoraId: String(formData.get("administradora_id") ?? ""),
      administradora: String(formData.get("administradora") ?? ""),
    },
    administradoras ?? [],
  );

  return {
    tipo_carta: tipo === "automovel" ? "automovel" : "imovel",
    ...administradora,
    credito: numForm(formData, "credito"),
    entrada: numForm(formData, "entrada"),
    prazo_quantidade: intForm(formData, "prazo_quantidade"),
    valor_parcela: numForm(formData, "valor_parcela"),
    saldo_devedor: numForm(formData, "saldo_devedor"),
    proxima_parcela_data: String(formData.get("proxima_parcela_data") ?? "").trim() || null,
    taxa_transferencia: numForm(formData, "taxa_transferencia"),
    texto_original: String(formData.get("texto_original") ?? "").trim() || null,
    status,
    ativo: formData.get("ativo") === "on",
    destaque: formData.get("destaque") === "on",
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
  };
}


export async function fetchCartasList(filters: {
  tipo?: string;
  status?: string;
  q?: string;
  ativo?: string;
}) {
  const supabase = await createClient();
  let q = supabase.from("cartas_contempladas").select("*").order("created_at", { ascending: false });

  if (filters.tipo) q = q.eq("tipo_carta", filters.tipo);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.ativo === "sim") q = q.eq("ativo", true);
  if (filters.ativo === "nao") q = q.eq("ativo", false);
  if (filters.q) q = q.ilike("administradora", `%${filters.q}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchCarta(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cartas_contempladas").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export type PublicCartasFilters = {
  tipo?: string;
  administradora?: string;
  creditoMin?: number;
  creditoMax?: number;
  entradaMin?: number;
  entradaMax?: number;
  status?: string;
  sort?: string;
  apenasDestaque?: boolean;
};

export async function fetchPublicCartas(filters: PublicCartasFilters = {}) {
  const { getCatalogEmpresaIdFromHeaders } = await import("@/lib/grupos/resolve-catalog-empresa");
  const { fetchPublicCartasAutorizadasForEmpresa } = await import(
    "@/lib/cartas/catalogo-autorizado-cartas"
  );
  const empresaId = await getCatalogEmpresaIdFromHeaders();
  if (!empresaId) return [];
  return fetchPublicCartasAutorizadasForEmpresa(empresaId, filters);
}

export async function createCartaAction(formData: FormData) {
  await requireUsuario();
  const supabase = await createClient();
  const payload = await cartaFromForm(formData);
  let result = await supabase.from("cartas_contempladas").insert(payload).select("id").single();
  if (isMissingCartaAdministradoraIdColumn(result.error?.message)) {
    result = await supabase
      .from("cartas_contempladas")
      .insert(withoutCartaAdministradoraId(payload))
      .select("id")
      .single();
  }
  const { data, error } = result;
  if (error) throw new Error(error.message);
  revalidatePath("/admin/cartas-contempladas");
  revalidatePath("/cartas-contempladas");
  redirect(`/admin/cartas-contempladas/${data.id}`);
}

export async function updateCartaAction(cartaId: string, formData: FormData) {
  await requireUsuario();
  const supabase = await createClient();
  const payload = await cartaFromForm(formData);
  let result = await supabase.from("cartas_contempladas").update(payload).eq("id", cartaId);
  if (isMissingCartaAdministradoraIdColumn(result.error?.message)) {
    result = await supabase
      .from("cartas_contempladas")
      .update(withoutCartaAdministradoraId(payload))
      .eq("id", cartaId);
  }
  const { error } = result;
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/cartas-contempladas/${cartaId}`);
  revalidatePath("/admin/cartas-contempladas");
  revalidatePath("/cartas-contempladas");
}


export async function deleteCartaAction(cartaId: string) {
  const usuario = await requireUsuario();
  if (!canDeleteRecords(usuario.perfil)) throw new Error("Apenas Master pode excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("cartas_contempladas").delete().eq("id", cartaId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/cartas-contempladas");
  revalidatePath("/cartas-contempladas");
  redirect("/admin/cartas-contempladas");
}

export async function quickCartaStatusAction(cartaId: string, status: string) {
  await requireUsuario();
  if (!CARTA_STATUS.includes(status as CartaStatus)) throw new Error("Status inválido");
  const supabase = await createClient();
  await supabase.from("cartas_contempladas").update({ status }).eq("id", cartaId);
  revalidatePath("/admin/cartas-contempladas");
  revalidatePath("/cartas-contempladas");
}

export async function toggleCartaDestaqueAction(cartaId: string, destaque: boolean) {
  await requireUsuario();
  const supabase = await createClient();
  await supabase.from("cartas_contempladas").update({ destaque }).eq("id", cartaId);
  revalidatePath("/admin/cartas-contempladas");
  revalidatePath("/cartas-contempladas");
}

export async function toggleCartaAtivoAction(cartaId: string, ativo: boolean) {
  await requireUsuario();
  const supabase = await createClient();
  await supabase.from("cartas_contempladas").update({ ativo }).eq("id", cartaId);
  revalidatePath("/admin/cartas-contempladas");
  revalidatePath("/cartas-contempladas");
}

export async function quickCartaStatusFormAction(formData: FormData) {
  const cartaId = String(formData.get("carta_id") ?? "");
  const status = String(formData.get("status") ?? "");
  await quickCartaStatusAction(cartaId, status);
}

export async function toggleCartaDestaqueFormAction(formData: FormData) {
  const cartaId = String(formData.get("carta_id") ?? "");
  const destaque = formData.get("destaque") === "true";
  await toggleCartaDestaqueAction(cartaId, destaque);
}

export async function toggleCartaAtivoFormAction(formData: FormData) {
  const cartaId = String(formData.get("carta_id") ?? "");
  const ativo = formData.get("ativo") === "true";
  await toggleCartaAtivoAction(cartaId, ativo);
}

export async function gerarPropostaFromCartaLeadAction(leadId: string) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (error || !lead) throw new Error(error?.message ?? "Lead não encontrado");

  const dados = (lead.dados_simulacao ?? {}) as Record<string, unknown>;
  const carta = (dados.carta ?? dados) as Record<string, unknown>;
  const tipoCarta = String(carta.tipo_carta ?? lead.produto_interesse ?? "imovel");
  const tipoBem = tipoCarta === "automovel" ? "Automóvel" : "Imóvel";

  const { data: prop, error: propErr } = await supabase
    .from("propostas")
    .insert({
      lead_id: leadId,
      nome_cliente: lead.nome,
      whatsapp_cliente: lead.whatsapp,
      email_cliente: lead.email,
      cidade_cliente: lead.cidade,
      tipo_proposta: "Carta contemplada",
      tipo_bem: tipoBem,
      valor_credito: lead.valor_simulado ?? numFromUnknown(carta.credito),
      prazo: lead.prazo_simulado ?? intFromUnknown(carta.prazo_quantidade),
      entrada: lead.entrada ?? numFromUnknown(carta.entrada),
      valor_parcela: numFromUnknown(carta.valor_parcela),
      dados_simulacao: { carta, origem: "carta_contemplada" },
      status: "Gerada",
      pdf_url: null,
    })
    .select("id")
    .single();

  if (propErr || !prop) throw new Error(propErr?.message ?? "Falha ao criar proposta");

  await enrichPropostaProjecaoFromSimulacao(prop.id);
  await generateAndStorePropostaPdf(prop.id, { origem: "carta_contemplada", pagina: "/admin/leads" });

  await registrarEvento({
    tipo_evento: "proposta_gerada",
    origem: "carta_contemplada",
    lead_id: leadId,
    usuario_id: usuario.id,
    entidade_tipo: "proposta",
    entidade_id: prop.id,
  });

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/propostas");
  redirect(`/admin/propostas/${prop.id}`);
}

function numFromUnknown(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intFromUnknown(v: unknown): number | null {
  const n = numFromUnknown(v);
  return n != null ? Math.round(n) : null;
}
