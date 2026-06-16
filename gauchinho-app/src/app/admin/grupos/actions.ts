"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import {
  canDeleteRecords,
  canEditSettings,
  canManageGrupos,
} from "@/lib/auth/permissions";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";
import { parseBulkCreditLines } from "@/lib/utils/format";
import { estimarCamposCotaBulk } from "@/lib/grupos/calculos";
import { parseSeguroInput } from "@/lib/grupos/seguro";
import { GRUPOS_TESTE } from "@/lib/grupos/dados-teste";
import type { GrupoModalidadeLance, PublicGrupoAggregate } from "@/lib/types";

function grupoFromForm(formData: FormData) {
  const seguroRaw = String(formData.get("seguro_percentual") ?? "");
  return {
    codigo_grupo: String(formData.get("codigo_grupo") ?? "").trim(),
    modalidade: String(formData.get("modalidade") ?? "Imóvel").trim(),
    administradora: String(formData.get("administradora") ?? "").trim() || null,
    taxa_administrativa_percentual: Number(formData.get("taxa_administrativa_percentual") ?? 0),
    fundo_reserva_percentual: Number(formData.get("fundo_reserva_percentual") ?? 0),
    seguro_habilitado: formData.get("seguro_habilitado") === "on",
    seguro_percentual: parseSeguroInput(seguroRaw),
    seguro_valor: Number(formData.get("seguro_valor") ?? 0) || null,
    tem_parcela_reduzida: formData.get("tem_parcela_reduzida") === "on",
    percentual_parcela_reduzida: Number(formData.get("percentual_parcela_reduzida") ?? 0),
    permite_lance_embutido: formData.get("permite_lance_embutido") === "on",
    percentual_lance_embutido: Number(formData.get("percentual_lance_embutido") ?? 0),
    percentual_recurso_proprio_sugerido: Number(
      formData.get("percentual_recurso_proprio_sugerido") ?? 0,
    ),
    prazo_total: Number(formData.get("prazo_total") ?? 0) || null,
    parcelas_realizadas: Number(formData.get("parcelas_realizadas") ?? 0) || 0,
    prazo_restante: Number(formData.get("prazo_restante") ?? 0) || null,
    seguro_pos_contemplacao: formData.get("seguro_pos_contemplacao") === "on",
    cet_percentual: Number(formData.get("cet_percentual") ?? 0) || null,
    status: String(formData.get("status") ?? "Disponível").trim(),
    ativo: formData.get("ativo") === "on",
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
  };
}

async function syncModalidadesLance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grupoId: string,
  formData: FormData,
) {
  const raw = String(formData.get("modalidades_json") ?? "[]");
  let rows: Array<{
    id?: string;
    nome: string;
    percentual_lance_embutido: number;
    percentual_recurso_proprio_minimo: number;
    descricao?: string | null;
    ativo: boolean;
    ordem: number;
  }> = [];
  try {
    rows = JSON.parse(raw);
  } catch {
    rows = [];
  }
  const { error: delErr } = await supabase
    .from("grupos_modalidades_lance")
    .delete()
    .eq("grupo_id", grupoId);
  if (delErr && !delErr.message.includes("does not exist")) {
    throw new Error(delErr.message);
  }
  if (!rows.length || delErr) return;
  const { error: insErr } = await supabase.from("grupos_modalidades_lance").insert(
    rows.map((r) => ({
      grupo_id: grupoId,
      nome: r.nome || "Modalidade",
      percentual_lance_embutido: r.percentual_lance_embutido,
      percentual_recurso_proprio_minimo: r.percentual_recurso_proprio_minimo,
      descricao: r.descricao ?? null,
      ativo: r.ativo,
      ordem: r.ordem,
    })),
  );
  if (insErr) throw new Error(insErr.message);
}

export async function fetchModalidadesByGrupoId(grupoId: string): Promise<GrupoModalidadeLance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grupos_modalidades_lance")
    .select("*")
    .eq("grupo_id", grupoId)
    .order("ordem", { ascending: true });
  if (error) return [];
  return (data ?? []) as GrupoModalidadeLance[];
}

async function assertCanManageGrupos() {
  const usuario = await requireUsuario();
  const leadsConfig = await getConfigJson("leads", DEFAULT_LEADS);
  if (!canManageGrupos(usuario.perfil, leadsConfig.srdPodeEditarGrupos)) {
    throw new Error("Sem permissão para gerenciar grupos");
  }
  return usuario;
}

type GrupoBulkConfig = Parameters<typeof estimarCamposCotaBulk>[1];

function cotaRowsFromCreditos(
  grupoId: string,
  creditos: number[],
  grupoConfig: GrupoBulkConfig,
  ordemStart = 0,
) {
  return creditos.map((valor_credito, i) => {
    const est = estimarCamposCotaBulk(valor_credito, grupoConfig);
    return {
      grupo_id: grupoId,
      valor_credito,
      saldo_devedor: est.saldo_devedor,
      valor_parcela: est.valor_parcela,
      parcela_integral: est.parcela_integral,
      parcela_reduzida: est.parcela_reduzida,
      parcela_com_seguro: est.parcela_com_seguro,
      parcela_sem_seguro: est.parcela_sem_seguro,
      status: "Disponível" as const,
      ativo: true,
      ordem: ordemStart + i,
    };
  });
}

async function insertCotasFromBulk(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grupoId: string,
  bulk: string,
  grupoConfig: GrupoBulkConfig,
  ordemStart = 0,
) {
  const creditos = parseBulkCreditLines(bulk);
  if (!creditos.length) return;
  await supabase.from("grupos_cotas").insert(cotaRowsFromCreditos(grupoId, creditos, grupoConfig, ordemStart));
}

export async function fetchGruposList(filters: {
  modalidade?: string;
  status?: string;
  q?: string;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("grupos_consorcio")
    .select("*, grupos_cotas(count)")
    .order("codigo_grupo", { ascending: true });

  if (filters.modalidade) q = q.eq("modalidade", filters.modalidade);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.q) q = q.ilike("codigo_grupo", `%${filters.q}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchGrupoWithCotas(id: string) {
  const supabase = await createClient();
  const { data: grupo, error } = await supabase
    .from("grupos_consorcio")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  const { data: cotas } = await supabase
    .from("grupos_cotas")
    .select("*")
    .eq("grupo_id", id)
    .order("ordem", { ascending: true });
  return { grupo, cotas: cotas ?? [] };
}

export async function createGrupoAction(formData: FormData) {
  await assertCanManageGrupos();
  const supabase = await createClient();
  const grupo = grupoFromForm(formData);
  const bulk = String(formData.get("cotas_bulk") ?? "");

  const { data, error } = await supabase.from("grupos_consorcio").insert(grupo).select("id").single();
  if (error) throw new Error(error.message);

  await insertCotasFromBulk(supabase, data.id, bulk, grupo);

  await syncModalidadesLance(supabase, data.id, formData);

  revalidatePath("/admin/grupos");
  redirect(`/admin/grupos/${data.id}`);
}

export async function updateGrupoAction(grupoId: string, formData: FormData) {
  await assertCanManageGrupos();
  const supabase = await createClient();
  const grupo = grupoFromForm(formData);
  const { error } = await supabase.from("grupos_consorcio").update(grupo).eq("id", grupoId);
  if (error) throw new Error(error.message);

  const bulk = String(formData.get("cotas_bulk") ?? "");
  const { data: maxOrdem } = await supabase
    .from("grupos_cotas")
    .select("ordem")
    .eq("grupo_id", grupoId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordemStart = (maxOrdem?.ordem ?? -1) + 1;
  await insertCotasFromBulk(supabase, grupoId, bulk, grupo, ordemStart);

  await syncModalidadesLance(supabase, grupoId, formData);

  revalidatePath(`/admin/grupos/${grupoId}`);
  revalidatePath("/admin/grupos");
  revalidatePath("/grupos");
  redirect(`/admin/grupos/${grupoId}?saved=1`);
}

function cotaFromForm(formData: FormData) {
  return {
    valor_credito: Number(formData.get("valor_credito") ?? 0),
    valor_parcela: Number(formData.get("valor_parcela") ?? 0) || null,
    parcela_integral: Number(formData.get("parcela_integral") ?? 0) || null,
    parcela_reduzida: Number(formData.get("parcela_reduzida") ?? 0) || null,
    parcela_com_seguro: Number(formData.get("parcela_com_seguro") ?? 0) || null,
    parcela_sem_seguro: Number(formData.get("parcela_sem_seguro") ?? 0) || null,
    saldo_devedor: Number(formData.get("saldo_devedor") ?? 0) || null,
    status: String(formData.get("status") ?? "Disponível").trim(),
    ativo: formData.get("ativo") === "on",
  };
}

export async function updateCotaAction(cotaId: string, grupoId: string, formData: FormData) {
  await assertCanManageGrupos();
  const supabase = await createClient();
  const row = cotaFromForm(formData);
  const { error } = await supabase.from("grupos_cotas").update(row).eq("id", cotaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/grupos/${grupoId}`);
  revalidatePath("/grupos");
}

export async function setCotaAtivoAction(cotaId: string, grupoId: string, ativo: boolean) {
  await assertCanManageGrupos();
  const supabase = await createClient();
  const { error } = await supabase.from("grupos_cotas").update({ ativo }).eq("id", cotaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/grupos/${grupoId}`);
  revalidatePath("/grupos");
}

export async function deleteCotaAction(cotaId: string, grupoId: string) {
  const usuario = await requireUsuario();
  if (!canDeleteRecords(usuario.perfil)) {
    throw new Error("Apenas Master pode excluir cotas definitivamente");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("grupos_cotas").delete().eq("id", cotaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/grupos/${grupoId}`);
  revalidatePath("/grupos");
}

export async function duplicateGrupoAction(grupoId: string) {
  await assertCanManageGrupos();
  const supabase = await createClient();
  const { grupo, cotas } = await fetchGrupoWithCotas(grupoId);
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = grupo;
  const copy = {
    ...rest,
    codigo_grupo: `${grupo.codigo_grupo}-copia`,
    ativo: true,
  };
  const { data: novo, error } = await supabase
    .from("grupos_consorcio")
    .insert(copy)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (cotas.length) {
    await supabase.from("grupos_cotas").insert(
      cotas.map(({ id: _cid, grupo_id: _gid, created_at: _ca, updated_at: _ua, ...cota }) => ({
        ...cota,
        grupo_id: novo.id,
      })),
    );
  }
  revalidatePath("/admin/grupos");
  redirect(`/admin/grupos/${novo.id}`);
}

export async function toggleGrupoAtivoAction(grupoId: string, ativo: boolean) {
  await assertCanManageGrupos();
  const supabase = await createClient();
  await supabase.from("grupos_consorcio").update({ ativo }).eq("id", grupoId);
  revalidatePath("/admin/grupos");
}

export async function deleteGrupoAction(grupoId: string) {
  const usuario = await requireUsuario();
  if (!canDeleteRecords(usuario.perfil)) throw new Error("Apenas Master pode excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("grupos_consorcio").delete().eq("id", grupoId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/grupos");
  redirect("/admin/grupos");
}

export async function fetchPublicGruposAggregates(): Promise<PublicGrupoAggregate[]> {
  const supabase = await createClient();
  const { data: grupos } = await supabase
    .from("grupos_consorcio")
    .select("*")
    .eq("ativo", true)
    .neq("status", "Inativo")
    .order("codigo_grupo");

  const { data: cotas } = await supabase
    .from("grupos_cotas")
    .select("*")
    .eq("ativo", true)
    .neq("status", "Inativo")
    .neq("status", "Esgotado")
    .order("ordem", { ascending: true });

  const { data: modalidades } = await supabase
    .from("grupos_modalidades_lance")
    .select("*")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  const cotasByGrupo = new Map<string, NonNullable<typeof cotas>>();
  (cotas ?? []).forEach((c) => {
    const list = cotasByGrupo.get(c.grupo_id) ?? [];
    list.push(c);
    cotasByGrupo.set(c.grupo_id, list);
  });

  const modsByGrupo = new Map<string, GrupoModalidadeLance[]>();
  (modalidades ?? []).forEach((m) => {
    const list = modsByGrupo.get(m.grupo_id) ?? [];
    list.push(m as GrupoModalidadeLance);
    modsByGrupo.set(m.grupo_id, list);
  });

  const aggregates: PublicGrupoAggregate[] = [];
  (grupos ?? []).forEach((g) => {
    const list = cotasByGrupo.get(g.id) ?? [];
    if (!list.length) return;
    list.sort((a, b) => Number(b.valor_credito) - Number(a.valor_credito));
    aggregates.push({
      grupo: g,
      cotas: list,
      modalidades: modsByGrupo.get(g.id) ?? [],
    });
  });

  return aggregates;
}

/** @deprecated use fetchPublicGruposAggregates */
export async function fetchPublicGruposRows() {
  const aggregates = await fetchPublicGruposAggregates();
  return aggregates.flatMap(({ grupo, cotas }) => cotas.map((cota) => ({ grupo, cota })));
}


export async function popularGruposTesteAction(): Promise<{
  created: number;
  skipped: number;
}> {
  const usuario = await requireUsuario();
  if (!canEditSettings(usuario.perfil)) {
    throw new Error("Apenas Master pode popular grupos de teste");
  }

  const supabase = await createClient();
  let created = 0;
  let skipped = 0;

  for (const def of GRUPOS_TESTE) {
    const { data: existing } = await supabase
      .from("grupos_consorcio")
      .select("id")
      .eq("codigo_grupo", def.codigo_grupo)
      .maybeSingle();

    if (existing) {
      skipped += 1;
      continue;
    }

    const { creditos, ...grupoFields } = def;
    const grupoRow = {
      ...grupoFields,
      administradora: "Racon",
      observacoes: "Dados de teste",
      ativo: true,
    };

    const { data: inserted, error } = await supabase
      .from("grupos_consorcio")
      .insert(grupoRow)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (creditos.length) {
      const { error: cotaErr } = await supabase
        .from("grupos_cotas")
        .insert(cotaRowsFromCreditos(inserted.id, creditos, grupoRow));
      if (cotaErr) throw new Error(cotaErr.message);
    }

    created += 1;
  }

  revalidatePath("/admin/grupos");
  revalidatePath("/grupos");
  return { created, skipped };
}
