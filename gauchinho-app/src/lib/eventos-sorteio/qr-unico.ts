import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slug";
import { fetchPublicSorteioByEventoId } from "./public";
import type { PublicSorteioView } from "./types";
import type { NpsPerguntaPublica } from "./nps";

export type QrCodeTipoDestino =
  | "site"
  | "evento"
  | "checkin_evento"
  | "whatsapp"
  | "pagina_interna"
  | "custom";

export type QrCodeUnicoRow = {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  tipo_destino?: QrCodeTipoDestino;
  destino_url?: string | null;
  destino_evento_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type QrCodeDestinoHistoricoRow = {
  id: string;
  qr_code_id: string;
  tipo_destino_anterior: string | null;
  destino_url_anterior: string | null;
  destino_evento_id_anterior: string | null;
  tipo_destino_novo: string;
  destino_url_novo: string | null;
  destino_evento_id_novo: string | null;
  alterado_por_id: string | null;
  alterado_por_nome?: string | null;
  motivo: string | null;
  created_at: string;
};

export type QrCodeVinculoRow = {
  id: string;
  qr_code_id: string;
  evento_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type QrCodeUnicoAdmin = QrCodeUnicoRow & {
  vinculoAtivo: (QrCodeVinculoRow & { evento_nome?: string; evento_slug?: string }) | null;
  destinoEventoNome?: string | null;
};

export type ResolveQrPublicResult =
  | {
      mode: "redirect";
      qr: QrCodeUnicoRow;
      url: string;
    }
  | {
      mode: "evento";
      qr: QrCodeUnicoRow;
      sorteio: PublicSorteioView;
      npsPerguntas: NpsPerguntaPublica[];
      vinculo: QrCodeVinculoRow;
    }
  | {
      mode: "sem_evento";
      qr: QrCodeUnicoRow;
      motivo: "inativo" | "sem_vinculo" | "fora_periodo" | "sorteio_indisponivel";
      /** Quando havia vínculo, evita cair no formulário legado sem NPS. */
      eventoNome?: string | null;
    };

export function normalizeQrSlug(input: string): string {
  return slugify(input) || "qr";
}

/** Compara período com Date (não string), tolerante a formatos do Postgres. */
export function periodoContemAgora(inicio: string, fim: string, agora = new Date()): boolean {
  const start = new Date(inicio).getTime();
  const end = new Date(fim).getTime();
  const now = agora.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(now)) return false;
  return now >= start && now <= end;
}

export async function listQrCodesUnicosAdmin(): Promise<QrCodeUnicoAdmin[]> {
  const admin = createAdminClient();
  const { data: qrs, error } = await admin
    .from("qr_codes_unicos")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw new Error(error.message);

  const { data: vinculos, error: vErr } = await admin
    .from("qr_codes_unicos_vinculos")
    .select("*, eventos(nome, slug)")
    .eq("ativo", true);
  if (vErr) throw new Error(vErr.message);

  type V = QrCodeVinculoRow & {
    eventos: { nome: string; slug: string } | { nome: string; slug: string }[] | null;
  };
  const byQr = new Map<string, QrCodeVinculoRow & { evento_nome?: string; evento_slug?: string }>();
  for (const v of (vinculos ?? []) as V[]) {
    const ev = Array.isArray(v.eventos) ? v.eventos[0] : v.eventos;
    byQr.set(v.qr_code_id, {
      id: v.id,
      qr_code_id: v.qr_code_id,
      evento_id: v.evento_id,
      periodo_inicio: v.periodo_inicio,
      periodo_fim: v.periodo_fim,
      ativo: v.ativo,
      created_at: v.created_at,
      updated_at: v.updated_at,
      evento_nome: ev?.nome,
      evento_slug: ev?.slug,
    });
  }

  return ((qrs ?? []) as QrCodeUnicoRow[]).map((q) => ({
    ...q,
    vinculoAtivo: byQr.get(q.id) ?? null,
  }));
}

/** QRs disponíveis para vincular a um evento (sem vínculo ativo em outro). */
export async function listQrCodesDisponiveisParaEvento(eventoId: string): Promise<QrCodeUnicoRow[]> {
  const all = await listQrCodesUnicosAdmin();
  return all
    .filter(
      (q) =>
        q.ativo &&
        (!q.vinculoAtivo || (!!eventoId && q.vinculoAtivo.evento_id === eventoId)),
    )
    .map(({ vinculoAtivo: _, ...row }) => {
      void _;
      return row;
    });
}

export async function fetchVinculoAtivoDoEvento(eventoId: string): Promise<
  | (QrCodeVinculoRow & { qr: QrCodeUnicoRow })
  | null
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qr_codes_unicos_vinculos")
    .select("*, qr_codes_unicos(*)")
    .eq("evento_id", eventoId)
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const qrRaw = (data as { qr_codes_unicos: QrCodeUnicoRow | QrCodeUnicoRow[] | null }).qr_codes_unicos;
  const qr = Array.isArray(qrRaw) ? qrRaw[0] : qrRaw;
  if (!qr) return null;
  return {
    id: data.id as string,
    qr_code_id: data.qr_code_id as string,
    evento_id: data.evento_id as string,
    periodo_inicio: data.periodo_inicio as string,
    periodo_fim: data.periodo_fim as string,
    ativo: data.ativo as boolean,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    qr,
  };
}

export async function fetchEventosQrVinculosMap(): Promise<
  Record<string, { qrId: string; qrNome: string; qrSlug: string }>
> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("qr_codes_unicos_vinculos")
      .select("evento_id, qr_codes_unicos(id, nome, slug)")
      .eq("ativo", true);
    if (error) return {};
    const res: Record<string, { qrId: string; qrNome: string; qrSlug: string }> = {};
    for (const row of (data ?? []) as Array<{
      evento_id: string;
      qr_codes_unicos: QrCodeUnicoRow | QrCodeUnicoRow[] | null;
    }>) {
      const qr = Array.isArray(row.qr_codes_unicos) ? row.qr_codes_unicos[0] : row.qr_codes_unicos;
      if (row.evento_id && qr) {
        res[row.evento_id] = { qrId: qr.id, qrNome: qr.nome, qrSlug: qr.slug };
      }
    }
    return res;
  } catch {
    return {};
  }
}

function nowIso() {
  return new Date().toISOString();
}

export async function resolveQrPublicBySlug(slug: string): Promise<ResolveQrPublicResult | null> {
  const normalized = normalizeQrSlug(slug);
  const admin = createAdminClient();
  const { data: qr, error } = await admin
    .from("qr_codes_unicos")
    .select("*")
    .eq("slug", normalized)
    .maybeSingle();
  if (error) {
    if (/qr_codes_unicos|schema cache|does not exist/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  if (!qr) return null;
  const qrRow = qr as QrCodeUnicoRow;
  if (!qrRow.ativo) {
    return { mode: "sem_evento", qr: qrRow, motivo: "inativo" };
  }

  const tipoDestino = qrRow.tipo_destino || "evento";

  if (tipoDestino === "site") {
    return { mode: "redirect", qr: qrRow, url: qrRow.destino_url || "/" };
  }

  if (tipoDestino === "whatsapp" || tipoDestino === "pagina_interna" || tipoDestino === "custom") {
    return { mode: "redirect", qr: qrRow, url: qrRow.destino_url || "/" };
  }

  if (tipoDestino === "checkin_evento" && qrRow.destino_evento_id) {
    const { data: ev } = await admin
      .from("eventos")
      .select("slug, ativo")
      .eq("id", qrRow.destino_evento_id)
      .maybeSingle();

    if (ev?.slug && ev.ativo) {
      return { mode: "redirect", qr: qrRow, url: `/eventos/${ev.slug}/sorteio` };
    }
  }

  const { data: vinculo, error: vErr } = await admin
    .from("qr_codes_unicos_vinculos")
    .select("*")
    .eq("qr_code_id", qrRow.id)
    .eq("ativo", true)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!vinculo) {
    return { mode: "sem_evento", qr: qrRow, motivo: "sem_vinculo" };
  }

  const v = vinculo as QrCodeVinculoRow;
  const { data: eventoMeta } = await admin
    .from("eventos")
    .select("id, nome, ativo")
    .eq("id", v.evento_id)
    .maybeSingle();
  const eventoNome = (eventoMeta?.nome as string | undefined) ?? null;

  if (!periodoContemAgora(v.periodo_inicio, v.periodo_fim)) {
    return { mode: "sem_evento", qr: qrRow, motivo: "fora_periodo", eventoNome };
  }

  // QR vinculado: mesmo formulário do sorteio (NPS completo), mesmo sem "publicado" na listagem.
  const sorteio = await fetchPublicSorteioByEventoId(v.evento_id, { requirePublicado: false });
  if (!sorteio) {
    return { mode: "sem_evento", qr: qrRow, motivo: "sorteio_indisponivel", eventoNome };
  }

  return {
    mode: "evento",
    qr: qrRow,
    sorteio,
    npsPerguntas: sorteio.npsPerguntas,
    vinculo: v,
  };
}

export async function criarQrCodeUnico(nome: string, slugInput?: string): Promise<QrCodeUnicoRow> {
  const admin = createAdminClient();
  const nomeTrim = nome.trim();
  if (!nomeTrim) throw new Error("Informe o nome do QR Code.");
  let slug = normalizeQrSlug(slugInput?.trim() || nomeTrim);
  const { data: existing } = await admin.from("qr_codes_unicos").select("slug").eq("slug", slug).maybeSingle();
  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }
  const { data, error } = await admin
    .from("qr_codes_unicos")
    .insert({ nome: nomeTrim, slug, ativo: true })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar QR Code.");
  return data as QrCodeUnicoRow;
}

export async function atualizarQrCodeUnico(
  id: string,
  patch: { nome?: string; slug?: string; ativo?: boolean },
): Promise<void> {
  const admin = createAdminClient();
  const row: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.nome !== undefined) {
    const n = patch.nome.trim();
    if (!n) throw new Error("Nome inválido.");
    row.nome = n;
  }
  if (patch.slug !== undefined) {
    row.slug = normalizeQrSlug(patch.slug);
  }
  if (patch.ativo !== undefined) row.ativo = patch.ativo;
  const { error } = await admin.from("qr_codes_unicos").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function vincularQrAoEvento(params: {
  qrCodeId: string;
  eventoId: string;
  periodoInicio: string;
  periodoFim: string;
}): Promise<void> {
  const admin = createAdminClient();
  const inicio = new Date(params.periodoInicio);
  const fim = new Date(params.periodoFim);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw new Error("Informe período de utilização válido.");
  }
  if (fim <= inicio) throw new Error("O fim do período deve ser após o início.");

  const { data: qr } = await admin
    .from("qr_codes_unicos")
    .select("id, ativo")
    .eq("id", params.qrCodeId)
    .maybeSingle();
  if (!qr?.id) throw new Error("QR Code não encontrado.");
  if (!qr.ativo) throw new Error("QR Code está inativo.");

  const { data: ocupado } = await admin
    .from("qr_codes_unicos_vinculos")
    .select("id, evento_id")
    .eq("qr_code_id", params.qrCodeId)
    .eq("ativo", true)
    .maybeSingle();
  if (ocupado && ocupado.evento_id !== params.eventoId) {
    throw new Error("Este QR Code já está ativo em outro evento. Desative-o lá antes de usar aqui.");
  }

  await admin
    .from("qr_codes_unicos_vinculos")
    .update({ ativo: false, updated_at: nowIso() })
    .eq("evento_id", params.eventoId)
    .eq("ativo", true)
    .neq("qr_code_id", params.qrCodeId);

  if (ocupado && ocupado.evento_id === params.eventoId) {
    const { error } = await admin
      .from("qr_codes_unicos_vinculos")
      .update({
        periodo_inicio: inicio.toISOString(),
        periodo_fim: fim.toISOString(),
        updated_at: nowIso(),
      })
      .eq("id", ocupado.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from("qr_codes_unicos_vinculos").insert({
    qr_code_id: params.qrCodeId,
    evento_id: params.eventoId,
    periodo_inicio: inicio.toISOString(),
    periodo_fim: fim.toISOString(),
    ativo: true,
  });
  if (error) throw new Error(error.message);
}

export async function desativarVinculoQrEvento(eventoId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("qr_codes_unicos_vinculos")
    .update({ ativo: false, updated_at: nowIso() })
    .eq("evento_id", eventoId)
    .eq("ativo", true);
  if (error) throw new Error(error.message);
}

export async function garantirQrInstitucionalSite(): Promise<QrCodeUnicoRow> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("qr_codes_unicos")
    .select("*")
    .eq("slug", "site")
    .maybeSingle();

  if (existing) {
    return existing as QrCodeUnicoRow;
  }

  // Cria se não existir
  const { data: created, error } = await admin
    .from("qr_codes_unicos")
    .insert({
      nome: "QR Institucional — Gauchinho",
      slug: "site",
      tipo_destino: "site",
      destino_url: "/",
      ativo: true,
    })
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`Falha ao inicializar QR Institucional: ${error?.message}`);
  }

  return created as QrCodeUnicoRow;
}

export async function atualizarDestinoQrCodeUnico(params: {
  qrId: string;
  tipoDestino: QrCodeTipoDestino;
  destinoUrl?: string | null;
  destinoEventoId?: string | null;
  usuarioId?: string | null;
  motivo?: string | null;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: qrAtual, error: qrErr } = await admin
    .from("qr_codes_unicos")
    .select("*")
    .eq("id", params.qrId)
    .single();

  if (qrErr || !qrAtual) {
    throw new Error("QR Code não encontrado.");
  }

  try {
    await admin.from("qr_codes_unicos_destinos_historico").insert({
      qr_code_id: params.qrId,
      tipo_destino_anterior: qrAtual.tipo_destino || "evento",
      destino_url_anterior: qrAtual.destino_url || null,
      destino_evento_id_anterior: qrAtual.destino_evento_id || null,
      tipo_destino_novo: params.tipoDestino,
      destino_url_novo: params.destinoUrl || null,
      destino_evento_id_novo: params.destinoEventoId || null,
      alterado_por_id: params.usuarioId || null,
      motivo: params.motivo || null,
    });
  } catch (err) {
    console.warn("[qr-unico] Erro ao gravar histórico de destino:", err);
  }

  const { error: updErr } = await admin
    .from("qr_codes_unicos")
    .update({
      tipo_destino: params.tipoDestino,
      destino_url: params.destinoUrl || null,
      destino_evento_id: params.destinoEventoId || null,
      updated_at: nowIso(),
    })
    .eq("id", params.qrId);

  if (updErr) {
    throw new Error(`Erro ao atualizar destino do QR Code: ${updErr.message}`);
  }
}

export async function buscarHistoricoDestinosQrCode(
  qrId: string
): Promise<QrCodeDestinoHistoricoRow[]> {
  const admin = createAdminClient();
  try {
    const { data, error } = await admin
      .from("qr_codes_unicos_destinos_historico")
      .select("*, usuarios(nome)")
      .eq("qr_code_id", qrId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return [];

    return (data ?? []).map((row: any) => ({
      id: row.id,
      qr_code_id: row.qr_code_id,
      tipo_destino_anterior: row.tipo_destino_anterior,
      destino_url_anterior: row.destino_url_anterior,
      destino_evento_id_anterior: row.destino_evento_id_anterior,
      tipo_destino_novo: row.tipo_destino_novo,
      destino_url_novo: row.destino_url_novo,
      destino_evento_id_novo: row.destino_evento_id_novo,
      alterado_por_id: row.alterado_por_id,
      alterado_por_nome: row.usuarios?.nome || null,
      motivo: row.motivo,
      created_at: row.created_at,
    }));
  } catch {
    return [];
  }
}
