"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import {
  canDeleteRecords,
  canEditSettings,
} from "@/lib/auth/permissions";
import { parseBulkCreditLines } from "@/lib/utils/format";
import { estimarCamposCotaBulk, calcularParcelasSeguroDaCota, type GrupoBulkEstimateInput } from "@/lib/grupos/calculos";
import {
  calcularPrazoGrupo,
  calcularPrazoGrupoFromRow,
  milestoneReajusteMeses,
} from "@/lib/grupos/prazos";
import { parcelaEfetivaCota } from "@/lib/grupos/reajuste-cotas";
import { canonicalSeguroFator, parseSeguroInput } from "@/lib/grupos/seguro";
import { GRUPOS_TESTE } from "@/lib/grupos/dados-teste";
import {
  deriveGrupoFlagsFromModalidades,
  parseModalidadesJson,
} from "@/lib/grupos/modalidades-admin";
import { resolveGrupoAdministradoraDualWriteFromForm } from "@/lib/grupos/administradora-repository";
import { RACON_ADMINISTRADORA_ID } from "@/lib/administradoras/constants";
import {
  upsertEmpresaGrupoConfig,
  deleteEmpresaGrupoConfig,
} from "@/lib/grupos/empresa-grupos-config";
import type { GrupoModalidadeLance, GrupoConsorcio, PublicGrupoAggregate } from "@/lib/types";
import { getCurrentTenantContext, requireTenantPermission } from "@/lib/tenant/context";
import { listarTabelasGrupos } from "@/lib/grupos/grupo-tabela.server";

const GRUPO_AUTO_PARCEL_COLS = [
  "parcelas_realizadas_base",
  "data_base_parcelas",
  "atualizacao_parcelas_automatica",
] as const;

const GRUPO_PARCELA_PERSONALIZADA_COLS = [
  "permite_parcela_reduzida_personalizada",
  "percentual_parcela_reduzida_personalizada",
] as const;

const GRUPO_OPTIONAL_COLS = [...GRUPO_AUTO_PARCEL_COLS, ...GRUPO_PARCELA_PERSONALIZADA_COLS] as const;

type GrupoRow = ReturnType<typeof grupoFromForm> &
  ReturnType<typeof deriveGrupoFlagsFromModalidades> & {
    administradora_id?: string | null;
  };

async function withAdministradoraDualWrite(
  formData: FormData,
  base: GrupoRow,
  opts?: { existingText?: string | null; administradoraIdOverride?: string | null },
): Promise<GrupoRow> {
  const dual = await resolveGrupoAdministradoraDualWriteFromForm({
    formData,
    existingText: opts?.existingText,
    administradoraIdOverride: opts?.administradoraIdOverride,
  });
  return {
    ...base,
    administradora_id: dual.administradora_id,
    administradora: dual.administradora,
  };
}

function stripAutoParcelCols<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row };
  for (const k of GRUPO_OPTIONAL_COLS) delete next[k];
  return next;
}

function isMissingAutoParcelColumnError(message: string): boolean {
  return GRUPO_OPTIONAL_COLS.some((c) => message.includes(c));
}

async function insertGrupoConsorcio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: GrupoRow,
) {
  let { data, error } = await supabase.from("grupos_consorcio").insert(row).select("id").single();
  if (error && isMissingAutoParcelColumnError(error.message)) {
    ({ data, error } = await supabase
      .from("grupos_consorcio")
      .insert(stripAutoParcelCols(row))
      .select("id")
      .single());
  }
  if (error) throw new Error(error.message);
  return data!;
}

async function updateGrupoConsorcio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grupoId: string,
  row: GrupoRow,
) {
  let { error } = await supabase.from("grupos_consorcio").update(row).eq("id", grupoId);
  if (error && isMissingAutoParcelColumnError(error.message)) {
    ({ error } = await supabase
      .from("grupos_consorcio")
      .update(stripAutoParcelCols(row))
      .eq("id", grupoId));
  }
  if (error) throw new Error(error.message);
}

function buildGrupoPayloadFromForm(formData: FormData): GrupoRow {
  const base = grupoFromForm(formData);
  const mods = parseModalidadesJson(String(formData.get("modalidades_json") ?? "[]"));
  const derived = deriveGrupoFlagsFromModalidades(mods);
  return { ...base, ...derived };
}

function isoDateLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function grupoConfigSeguroFromRow(grupo: Record<string, unknown>): GrupoBulkEstimateInput {
  const prazo = calcularPrazoGrupo({
    prazoTotal: grupo.prazo_total != null ? Number(grupo.prazo_total) : null,
    parcelasRealizadasBase:
      grupo.parcelas_realizadas_base != null
        ? Number(grupo.parcelas_realizadas_base)
        : grupo.parcelas_realizadas != null
          ? Number(grupo.parcelas_realizadas)
          : null,
    dataBaseParcelas: (grupo.data_base_parcelas as string) ?? null,
    atualizacaoAutomatica: !!grupo.atualizacao_parcelas_automatica,
    parcelasRealizadasManual: Number(grupo.parcelas_realizadas ?? 0),
    prazoRestanteManual: grupo.prazo_restante != null ? Number(grupo.prazo_restante) : null,
  });
  return {
    seguro_habilitado: !!grupo.seguro_habilitado,
    seguro_pos_contemplacao: !!grupo.seguro_pos_contemplacao,
    seguro_percentual:
      grupo.seguro_percentual != null ? Number(grupo.seguro_percentual) : null,
    seguro_valor: grupo.seguro_valor != null ? Number(grupo.seguro_valor) : null,
    tem_parcela_reduzida: !!grupo.tem_parcela_reduzida,
    percentual_parcela_reduzida:
      grupo.percentual_parcela_reduzida != null
        ? Number(grupo.percentual_parcela_reduzida)
        : null,
    taxa_administrativa_percentual: Number(grupo.taxa_administrativa_percentual ?? 0),
    fundo_reserva_percentual: Number(grupo.fundo_reserva_percentual ?? 0),
    prazo_total: prazo.prazoTotal || null,
    parcelas_realizadas: prazo.parcelasRealizadasAtuais,
    prazo_restante: prazo.prazoRestanteAtual,
  };
}

function grupoFromForm(formData: FormData) {
  const seguroRaw = String(formData.get("seguro_percentual") ?? "");
  const prazo_total = Number(formData.get("prazo_total") ?? 0) || null;
  const parcelas_realizadas = Number(formData.get("parcelas_realizadas") ?? 0) || 0;
  const prazo_restante = Number(formData.get("prazo_restante") ?? 0) || null;
  const parcelas_base_raw = String(formData.get("parcelas_realizadas_base") ?? "").trim();
  const parcelas_realizadas_base = parcelas_base_raw
    ? Number(parcelas_base_raw) || 0
    : null;
  const data_base_parcelas =
    String(formData.get("data_base_parcelas") ?? "").trim() || null;
  const atualizacao_parcelas_automatica =
    formData.get("atualizacao_parcelas_automatica") === "on";

  let finalBase = parcelas_realizadas_base;
  let finalDataBase = data_base_parcelas;
  let finalAuto = atualizacao_parcelas_automatica;

  if (formData.get("fixar_base_parcelas") === "on") {
    const calc = calcularPrazoGrupo({
      prazoTotal: prazo_total,
      parcelasRealizadasBase: parcelas_realizadas_base ?? parcelas_realizadas,
      dataBaseParcelas: data_base_parcelas ?? isoDateLocal(),
      atualizacaoAutomatica: true,
      parcelasRealizadasManual: parcelas_realizadas,
      prazoRestanteManual: prazo_restante,
    });
    finalBase = calc.parcelasRealizadasAtuais;
    finalDataBase = isoDateLocal();
    finalAuto = true;
  }

  return {
    codigo_grupo: String(formData.get("codigo_grupo") ?? "").trim(),
    modalidade: String(formData.get("modalidade") ?? "Imóvel").trim(),
    tipo_administradora_id: String(formData.get("tipo_administradora_id") ?? "").trim() || null,
    modalidade_comissao_id: String(formData.get("modalidade_comissao_id") ?? "").trim() || null,
    usar_regra_personalizada: formData.get("usar_regra_personalizada") === "on",
    regra_personalizada_vigencia_inicio: String(formData.get("regra_personalizada_vigencia_inicio") ?? "").trim() || null,
    regra_personalizada_vigencia_fim: String(formData.get("regra_personalizada_vigencia_fim") ?? "").trim() || null,
    regra_personalizada_versao: Number(formData.get("regra_personalizada_versao") ?? 0) || null,
    administradora: String(formData.get("administradora") ?? "").trim() || null,
    taxa_administrativa_percentual: Number(formData.get("taxa_administrativa_percentual") ?? 0),
    fundo_reserva_percentual: Number(formData.get("fundo_reserva_percentual") ?? 0),
    seguro_habilitado: formData.get("seguro_habilitado") === "on",
    seguro_percentual: canonicalSeguroFator(parseSeguroInput(seguroRaw)),
    seguro_valor: Number(formData.get("seguro_valor") ?? 0) || null,
    prazo_total,
    parcelas_realizadas,
    prazo_restante,
    parcelas_realizadas_base: finalBase,
    data_base_parcelas: finalDataBase,
    atualizacao_parcelas_automatica: finalAuto,
    seguro_pos_contemplacao: formData.get("seguro_pos_contemplacao") === "on",
    cet_percentual: Number(formData.get("cet_percentual") ?? 0) || null,
    status: String(formData.get("status") ?? "Disponível").trim(),
    ativo: formData.get("ativo") === "on",
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    quantidade_cotas_sorteio: parseQuantidadeCotasSorteioForm(formData),
    permite_parcela_reduzida_personalizada:
      formData.get("permite_parcela_reduzida_personalizada") === "on",
    percentual_parcela_reduzida_personalizada: parsePercentualParcelaPersonalizadaForm(formData),
  };
}

function parsePercentualParcelaPersonalizadaForm(formData: FormData): number | null {
  const raw = String(formData.get("percentual_parcela_reduzida_personalizada") ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n >= 100) {
    throw new Error(
      "Percentual da parcela reduzida personalizada deve ser entre 0 e 100 (ex.: 40).",
    );
  }
  return n;
}

function parseQuantidadeCotasSorteioForm(formData: FormData): number | null {
  const raw = String(formData.get("quantidade_cotas_sorteio") ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("Quantidade de cotas para sorteio deve ser um inteiro maior que zero.");
  }
  return n;
}

async function recalcularParcelasCotasGrupo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grupoId: string,
  grupoConfig: ReturnType<typeof grupoFromForm>,
) {
  const { data: cotas, error } = await supabase
    .from("grupos_cotas")
    .select("id, valor_credito, saldo_devedor")
    .eq("grupo_id", grupoId);
  if (error) throw new Error(error.message);
  if (!cotas?.length) return;

  for (const cota of cotas) {
    const credito = Number(cota.valor_credito);
    if (!Number.isFinite(credito) || credito <= 0) continue;
    const saldo =
      cota.saldo_devedor != null && Number(cota.saldo_devedor) > 0
        ? Number(cota.saldo_devedor)
        : null;
    const est = estimarCamposCotaBulk(credito, grupoConfig, saldo);
    const { error: upErr } = await supabase
      .from("grupos_cotas")
      .update({
        saldo_devedor: est.saldo_devedor,
        valor_parcela: est.valor_parcela,
        parcela_integral: est.parcela_integral,
        parcela_reduzida: est.parcela_reduzida,
        parcela_com_seguro: est.parcela_com_seguro,
        parcela_sem_seguro: est.parcela_sem_seguro,
      })
      .eq("id", cota.id);
    if (upErr) throw new Error(upErr.message);
  }
}

async function modalidadesSupabaseClient() {
  try {
    return createAdminClient();
  } catch {
    return await createClient();
  }
}

async function syncModalidadesLance(grupoId: string, formData: FormData) {
  const rows = parseModalidadesJson(String(formData.get("modalidades_json") ?? "[]"));
  const admin = await modalidadesSupabaseClient();

  const { error: delErr } = await admin
    .from("grupos_modalidades_lance")
    .delete()
    .eq("grupo_id", grupoId);

  const tableMissing =
    delErr &&
    (delErr.message.includes("does not exist") ||
      delErr.message.includes("grupos_modalidades_lance") ||
      delErr.code === "42P01");

  if (delErr && !tableMissing) {
    throw new Error(delErr.message);
  }
  if (tableMissing || !rows.length) return;

  const fullPayload = rows.map((r) => ({
    grupo_id: grupoId,
    nome: r.nome || "Modalidade",
    percentual_lance_embutido: r.percentual_lance_embutido,
    percentual_recurso_proprio_minimo: r.percentual_recurso_proprio_minimo,
    descricao: r.descricao ?? null,
    ativo: r.ativo,
    ordem: r.ordem,
    tipo_parcela: r.tipo_parcela ?? null,
    percentual_parcela_reduzida: r.percentual_parcela_reduzida ?? null,
  }));

  let { error: insErr } = await admin.from("grupos_modalidades_lance").insert(fullPayload);
  if (
    insErr &&
    (insErr.message.includes("tipo_parcela") ||
      insErr.message.includes("percentual_parcela_reduzida"))
  ) {
    const legacyPayload = fullPayload.map((item) => ({
      grupo_id: item.grupo_id,
      nome: item.nome,
      percentual_lance_embutido: item.percentual_lance_embutido,
      percentual_recurso_proprio_minimo: item.percentual_recurso_proprio_minimo,
      descricao: item.descricao,
      ativo: item.ativo,
      ordem: item.ordem,
    }));
    ({ error: insErr } = await admin.from("grupos_modalidades_lance").insert(legacyPayload));
  }
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
  const isSuper = await isPlatformSuperadmin();
  if (!isSuper) {
    throw new Error("Apenas SuperAdmins da plataforma podem alterar ou gerenciar a estrutura do catálogo global de grupos.");
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
  const { error } = await supabase.from("grupos_cotas").insert(cotaRowsFromCreditos(grupoId, creditos, grupoConfig, ordemStart));
  if (error) throw new Error(error.message);
}

export async function fetchGruposList(filters: {
  modalidade?: string;
  status?: string;
  q?: string;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("grupos_consorcio")
    .select("*, tipo:administradora_tipos(nome), grupos_cotas(count)")
    .order("codigo_grupo", { ascending: true });

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.q) q = q.ilike("codigo_grupo", `%${filters.q}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const tabelas = await listarTabelasGrupos((data ?? []).map((grupo) => grupo.id));
  const normalizados = (data ?? []).map((grupo) => ({
    ...grupo,
    modalidade: (grupo.tipo as unknown as { nome?: string } | null)?.nome ?? grupo.modalidade,
    tabela_grupo: tabelas.get(grupo.id) ?? null,
  }));
  return filters.modalidade
    ? normalizados.filter((grupo) => grupo.modalidade === filters.modalidade)
    : normalizados;
}

export async function fetchGrupoWithCotas(id: string) {
  const supabase = await createClient();
  const { data: grupo, error } = await supabase
    .from("grupos_consorcio")
    .select("*, tipo:administradora_tipos(nome), administradora_rel:administradoras(nome)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  const [{ data: cotas }, { data: modalidadesLance }] = await Promise.all([
    supabase.from("grupos_cotas").select("*").eq("grupo_id", id).order("ordem", { ascending: true }),
    supabase.from("grupos_modalidades_lance").select("*").eq("grupo_id", id).eq("ativo", true).order("ordem", { ascending: true }),
  ]);
  return {
    grupo: {
      ...grupo,
      modalidade: (grupo.tipo as unknown as { nome?: string } | null)?.nome ?? grupo.modalidade,
    },
    cotas: cotas ?? [],
    modalidadesLance: modalidadesLance ?? [],
  };
}

export async function createGrupoAction(formData: FormData) {
  await assertCanManageGrupos();
  const supabase = await createClient();
  const isPlatform = await isPlatformSuperadmin();
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!isPlatform && !empresaAtiva) throw new Error("Selecione uma empresa para criar o grupo local.");
  const grupoBase = await withAdministradoraDualWrite(
    formData,
    buildGrupoPayloadFromForm(formData),
  );
  const grupo = {
    ...grupoBase,
    origem_governanca: isPlatform ? "GLOBAL" : "LOCAL",
    status_governanca: isPlatform ? "GLOBAL" : "PENDENTE_PLATFORM",
    empresa_origem_id: isPlatform ? null : empresaAtiva!.id,
  };
  const bulk = String(formData.get("cotas_bulk") ?? "");

  const data = await insertGrupoConsorcio(supabase, grupo);

  await insertCotasFromBulk(supabase, data.id, bulk, grupo);

  await syncModalidadesLance(data.id, formData);
  if (!isPlatform) await supabase.from("grupos_governanca_historico").insert({ grupo_id: data.id, empresa_origem_id: empresaAtiva!.id, evento: "CRIADO_LOCAL" });

  revalidatePath("/admin/grupos");
  redirect(`/admin/grupos/${data.id}`);
}

export async function updateGrupoAction(grupoId: string, formData: FormData) {
  await assertCanManageGrupos();
  const supabase = await createClient();
  const { data: existingGrupo } = await supabase
    .from("grupos_consorcio")
    .select("administradora, administradora_id")
    .eq("id", grupoId)
    .maybeSingle();
  const grupo = await withAdministradoraDualWrite(
    formData,
    buildGrupoPayloadFromForm(formData),
    {
      existingText: existingGrupo?.administradora ?? null,
      administradoraIdOverride: existingGrupo?.administradora_id ?? null,
    },
  );
  try {
    await updateGrupoConsorcio(supabase, grupoId, grupo);

    await recalcularParcelasCotasGrupo(supabase, grupoId, grupo);

    const bulk = String(formData.get("cotas_bulk") ?? "").trim();
    if (bulk) {
      const { data: maxOrdem } = await supabase
        .from("grupos_cotas")
        .select("ordem")
        .eq("grupo_id", grupoId)
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();
      const ordemStart = (maxOrdem?.ordem ?? -1) + 1;
      await insertCotasFromBulk(supabase, grupoId, bulk, grupo, ordemStart);
    }

    await syncModalidadesLance(grupoId, formData);
  } catch (err) {
    const digest =
      typeof err === "object" && err !== null && "digest" in err
        ? String((err as { digest: unknown }).digest)
        : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw err;
    const msg = err instanceof Error ? err.message : "Erro ao salvar grupo";
    redirect(`/admin/grupos/${grupoId}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/admin/grupos/${grupoId}`);
  revalidatePath("/admin/grupos");
  revalidatePath("/grupos");
  redirect(`/admin/grupos/${grupoId}?saved=1`);
}

/** Marca o reajuste de crédito no marco atual (12/24/36…) e remove o destaque na lista. */
export async function marcarReajusteCreditoGrupoAction(
  grupoId: string,
): Promise<{ ok: true; marco: number } | { ok: false; error: string }> {
  try {
    await assertCanManageGrupos();
    const admin = createAdminClient();
    const { data: grupo, error } = await admin
      .from("grupos_consorcio")
      .select(
        "id, prazo_total, parcelas_realizadas, prazo_restante, parcelas_realizadas_base, data_base_parcelas, atualizacao_parcelas_automatica, credito_reajustado_ate_meses",
      )
      .eq("id", grupoId)
      .maybeSingle();
    if (error) {
      if (/credito_reajustado_ate_meses/i.test(error.message)) {
        return {
          ok: false,
          error:
            "Aplique a migration supabase/migrations/032_grupos_credito_reajustado_ate_meses.sql no Supabase.",
        };
      }
      return { ok: false, error: error.message };
    }
    if (!grupo) return { ok: false, error: "Grupo não encontrado." };

    const prazo = calcularPrazoGrupoFromRow(grupo as GrupoConsorcio);
    const marco = milestoneReajusteMeses(prazo.parcelasRealizadasAtuais);
    if (marco < 12) {
      return { ok: false, error: "Este grupo ainda não chegou a um marco de 12 meses." };
    }

    const { error: updErr } = await admin
      .from("grupos_consorcio")
      .update({
        credito_reajustado_ate_meses: marco,
        updated_at: new Date().toISOString(),
      })
      .eq("id", grupoId);
    if (updErr) {
      if (/credito_reajustado_ate_meses/i.test(updErr.message)) {
        return {
          ok: false,
          error:
            "Aplique a migration supabase/migrations/032_grupos_credito_reajustado_ate_meses.sql no Supabase.",
        };
      }
      return { ok: false, error: updErr.message };
    }

    revalidatePath("/admin/grupos");
    revalidatePath(`/admin/grupos/${grupoId}`);
    return { ok: true, marco };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao marcar reajuste." };
  }
}

export type CotaReajusteAdminRow = {
  id: string;
  ordem: number | null;
  valor_credito: number;
  valor_parcela: number;
  parcela_integral: number | null;
  parcela_reduzida: number | null;
  saldo_devedor: number | null;
};

/** Cotas do grupo para a tela de reajuste (crédito + parcela). */
export async function fetchCotasParaReajusteAction(grupoId: string): Promise<
  | {
      ok: true;
      grupo: { id: string; codigo_grupo: string; modalidade: string };
      cotas: CotaReajusteAdminRow[];
      marco: number;
      precisaMarcarReajuste: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    await assertCanManageGrupos();
    const supabase = await createClient();
    const { data: grupo, error } = await supabase
      .from("grupos_consorcio")
      .select(
        "id, codigo_grupo, modalidade, prazo_total, parcelas_realizadas, prazo_restante, parcelas_realizadas_base, data_base_parcelas, atualizacao_parcelas_automatica, credito_reajustado_ate_meses, tem_parcela_reduzida",
      )
      .eq("id", grupoId)
      .maybeSingle();
    if (error || !grupo) return { ok: false, error: error?.message ?? "Grupo não encontrado." };

    const { data: cotas, error: cErr } = await supabase
      .from("grupos_cotas")
      .select(
        "id, ordem, valor_credito, valor_parcela, parcela_integral, parcela_reduzida, saldo_devedor, ativo",
      )
      .eq("grupo_id", grupoId)
      .order("ordem", { ascending: true });
    if (cErr) return { ok: false, error: cErr.message };

    const prazo = calcularPrazoGrupoFromRow(grupo as GrupoConsorcio);
    const marco = milestoneReajusteMeses(prazo.parcelasRealizadasAtuais);
    const precisaMarcarReajuste =
      marco >= 12 && marco > (Number(grupo.credito_reajustado_ate_meses) || 0);

    return {
      ok: true,
      grupo: {
        id: grupo.id as string,
        codigo_grupo: grupo.codigo_grupo as string,
        modalidade: grupo.modalidade as string,
      },
      cotas: (cotas ?? [])
        .filter((c) => c.ativo !== false)
        .map((c) => ({
          id: c.id as string,
          ordem: (c.ordem as number | null) ?? null,
          valor_credito: Number(c.valor_credito) || 0,
          valor_parcela: parcelaEfetivaCota({
            valor_parcela: c.valor_parcela as number | null,
            parcela_reduzida: c.parcela_reduzida as number | null,
            parcela_integral: c.parcela_integral as number | null,
          }),
          parcela_integral: c.parcela_integral != null ? Number(c.parcela_integral) : null,
          parcela_reduzida: c.parcela_reduzida != null ? Number(c.parcela_reduzida) : null,
          saldo_devedor: c.saldo_devedor != null ? Number(c.saldo_devedor) : null,
        })),
      marco,
      precisaMarcarReajuste,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao carregar cotas." };
  }
}

export type ReajusteCotaInput = {
  id: string;
  valor_credito: number;
  valor_parcela: number;
};

/**
 * Aplica crédito e parcela em todas as cotas e, se estiver no marco 12/24/36…,
 * marca o reajuste (remove destaque na lista).
 */
export async function reajustarCotasGrupoAction(
  grupoId: string,
  cotas: ReajusteCotaInput[],
  opts?: { marcarReajuste?: boolean },
): Promise<{ ok: true; marco: number | null } | { ok: false; error: string }> {
  try {
    await assertCanManageGrupos();
    if (!cotas.length) return { ok: false, error: "Nenhuma cota para reajustar." };

    const admin = createAdminClient();
    const { data: grupo, error: gErr } = await admin
      .from("grupos_consorcio")
      .select("*")
      .eq("id", grupoId)
      .maybeSingle();
    if (gErr || !grupo) return { ok: false, error: gErr?.message ?? "Grupo não encontrado." };

    const { data: atuais, error: cErr } = await admin
      .from("grupos_cotas")
      .select(
        "id, valor_credito, valor_parcela, parcela_integral, parcela_reduzida, saldo_devedor",
      )
      .eq("grupo_id", grupoId);
    if (cErr) return { ok: false, error: cErr.message };

    const byId = new Map((atuais ?? []).map((c) => [c.id as string, c]));
    const seguroCfg = grupoConfigSeguroFromRow(grupo as Record<string, unknown>);
    const temReduzida = !!(grupo as { tem_parcela_reduzida?: boolean }).tem_parcela_reduzida;

    for (const item of cotas) {
      const old = byId.get(item.id);
      if (!old) continue;
      const credito = Number(item.valor_credito);
      const parcela = Number(item.valor_parcela);
      if (!Number.isFinite(credito) || credito <= 0) {
        return { ok: false, error: "Informe um crédito válido em todas as cotas." };
      }
      if (!Number.isFinite(parcela) || parcela < 0) {
        return { ok: false, error: "Informe uma parcela válida em todas as cotas." };
      }

      const oldCredito = Number(old.valor_credito) || credito;
      const fatorCredito = oldCredito > 0 ? credito / oldCredito : 1;
      const oldSaldo =
        old.saldo_devedor != null && Number(old.saldo_devedor) > 0
          ? Number(old.saldo_devedor)
          : null;
      const saldo_devedor =
        oldSaldo != null
          ? Math.round(oldSaldo * fatorCredito * 100) / 100
          : estimarCamposCotaBulk(credito, seguroCfg).saldo_devedor;

      const oldIntegral =
        old.parcela_integral != null && Number(old.parcela_integral) > 0
          ? Number(old.parcela_integral)
          : null;
      const oldReduzida =
        old.parcela_reduzida != null && Number(old.parcela_reduzida) > 0
          ? Number(old.parcela_reduzida)
          : null;
      const oldParcelaEfetiva = parcelaEfetivaCota({
        valor_parcela: old.valor_parcela as number | null,
        parcela_reduzida: oldReduzida,
        parcela_integral: oldIntegral,
      });
      const fatorParcela = oldParcelaEfetiva > 0 ? parcela / oldParcelaEfetiva : fatorCredito;

      let parcela_integral: number;
      let parcela_reduzida: number | null;
      if (temReduzida && oldReduzida != null) {
        parcela_reduzida = Math.round(parcela * 100) / 100;
        parcela_integral =
          oldIntegral != null
            ? Math.round(oldIntegral * fatorParcela * 100) / 100
            : Math.round(parcela * 100) / 100;
      } else {
        parcela_integral = Math.round(parcela * 100) / 100;
        parcela_reduzida =
          oldReduzida != null ? Math.round(oldReduzida * fatorParcela * 100) / 100 : null;
      }

      const parcelas = calcularParcelasSeguroDaCota(
        {
          saldoDevedor: saldo_devedor,
          parcelaIntegral: parcela_integral,
          parcelaReduzida: parcela_reduzida,
        },
        seguroCfg,
      );

      const { error: upErr } = await admin
        .from("grupos_cotas")
        .update({
          valor_credito: Math.round(credito * 100) / 100,
          valor_parcela: Math.round(parcela * 100) / 100,
          saldo_devedor,
          parcela_integral,
          parcela_reduzida,
          parcela_sem_seguro: parcelas.parcelaSemSeguro,
          parcela_com_seguro: parcelas.parcelaComSeguroPersistida,
        })
        .eq("id", item.id)
        .eq("grupo_id", grupoId);
      if (upErr) return { ok: false, error: upErr.message };
    }

    let marco: number | null = null;
    const marcar = opts?.marcarReajuste !== false;
    if (marcar) {
      const prazo = calcularPrazoGrupoFromRow(grupo as GrupoConsorcio);
      marco = milestoneReajusteMeses(prazo.parcelasRealizadasAtuais);
      if (marco >= 12) {
        const { error: updErr } = await admin
          .from("grupos_consorcio")
          .update({
            credito_reajustado_ate_meses: marco,
            updated_at: new Date().toISOString(),
          })
          .eq("id", grupoId);
        if (updErr && !/credito_reajustado_ate_meses/i.test(updErr.message)) {
          return { ok: false, error: updErr.message };
        }
      }
    }

    revalidatePath("/admin/grupos");
    revalidatePath(`/admin/grupos/${grupoId}`);
    revalidatePath("/grupos");
    return { ok: true, marco };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao reajustar cotas." };
  }
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
  const { data: grupo, error: gErr } = await supabase
    .from("grupos_consorcio")
    .select("*")
    .eq("id", grupoId)
    .single();
  if (gErr) throw new Error(gErr.message);
  const row = cotaFromForm(formData);
  const saldo =
    row.saldo_devedor != null && row.saldo_devedor > 0
      ? row.saldo_devedor
      : row.valor_credito;
  const integral = row.parcela_integral ?? row.parcela_sem_seguro ?? row.valor_parcela ?? 0;
  const seguroCfg = grupoConfigSeguroFromRow(grupo as Record<string, unknown>);
  const parcelas = calcularParcelasSeguroDaCota(
    {
      saldoDevedor: saldo,
      parcelaIntegral: integral,
      parcelaReduzida: row.parcela_reduzida,
    },
    seguroCfg,
  );
  row.parcela_sem_seguro = parcelas.parcelaSemSeguro;
  row.parcela_com_seguro = parcelas.parcelaComSeguroPersistida;
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
  const rest = { ...grupo };
  delete rest.id;
  delete rest.created_at;
  delete rest.updated_at;
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
      cotas.map((item) => {
        const cota = { ...item };
        delete cota.id;
        delete cota.grupo_id;
        delete cota.created_at;
        delete cota.updated_at;
        return { ...cota, grupo_id: novo.id };
      }),
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

/**
 * Catálogo público tenant-scoped (Fase 4 E6).
 * Resolve empresa pelo Host/proxy — nunca por empresa_id do client.
 * Sem tenant resolvido → lista vazia (não vaza catálogo global).
 */
export async function fetchPublicGruposAggregates(): Promise<PublicGrupoAggregate[]> {
  const { getCatalogEmpresaIdFromHeaders } = await import(
    "@/lib/grupos/resolve-catalog-empresa"
  );
  const { fetchPublicGruposAggregatesForEmpresa } = await import(
    "@/lib/grupos/catalogo-autorizado-service"
  );
  const empresaId = await getCatalogEmpresaIdFromHeaders();
  if (!empresaId) return [];
  return fetchPublicGruposAggregatesForEmpresa(empresaId);
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
      administradora_id: RACON_ADMINISTRADORA_ID,
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

export async function updateEmpresaGrupoConfigAction(formData: FormData) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_grupos");
  const empresaIdInformada = (formData.get("empresa_id") as string)?.trim();
  const empresaId = empresaAtiva.id;
  const grupoId = (formData.get("grupo_id") as string)?.trim();

  if (!grupoId || (empresaIdInformada && empresaIdInformada !== empresaId)) {
    throw new Error("Identificadores de empresa e grupo são obrigatórios.");
  }

  const visivel = formData.get("visivel") === "true";
  const destaque = formData.get("destaque") === "true";
  const ordemRaw = (formData.get("ordem") as string)?.trim();
  const ordem = ordemRaw ? parseInt(ordemRaw, 10) : null;
  const tituloComercial = (formData.get("titulo_comercial") as string)?.trim() || null;
  const descricaoComercial = (formData.get("descricao_comercial") as string)?.trim() || null;

  await upsertEmpresaGrupoConfig(empresaId, grupoId, {
    visivel,
    destaque,
    ordem: isNaN(ordem as number) ? null : ordem,
    titulo_comercial: tituloComercial,
    descricao_comercial: descricaoComercial,
  });

  revalidatePath("/admin/grupos");
  revalidatePath("/grupos");
  revalidatePath("/simulador");
  revalidatePath("/");
}

export async function resetEmpresaGrupoConfigAction(formData: FormData) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_grupos");
  const empresaIdInformada = (formData.get("empresa_id") as string)?.trim();
  const empresaId = empresaAtiva.id;
  const grupoId = (formData.get("grupo_id") as string)?.trim();

  if (!grupoId || (empresaIdInformada && empresaIdInformada !== empresaId)) {
    throw new Error("Identificadores de empresa e grupo são obrigatórios.");
  }

  await deleteEmpresaGrupoConfig(empresaId, grupoId);

  revalidatePath("/admin/grupos");
  revalidatePath("/grupos");
  revalidatePath("/simulador");
  revalidatePath("/");
}
