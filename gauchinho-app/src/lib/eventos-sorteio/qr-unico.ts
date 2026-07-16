import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slug";
import { fetchPublicSorteioByEventoSlug } from "./public";
import type { PublicSorteioView } from "./types";
import type { NpsPerguntaPublica } from "./nps";

export type QrCodeUnicoRow = {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
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
};

export type ResolveQrPublicResult =
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
    };

export function normalizeQrSlug(input: string): string {
  return slugify(input) || "qr";
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
    .map(({ vinculoAtivo: _v, ...row }) => row);
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

function nowIso() {
  return new Date().toISOString();
}

function periodoContemAgora(inicio: string, fim: string, agora = nowIso()): boolean {
  return agora >= inicio && agora <= fim;
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
  if (!periodoContemAgora(v.periodo_inicio, v.periodo_fim)) {
    return { mode: "sem_evento", qr: qrRow, motivo: "fora_periodo" };
  }

  const { data: evento, error: evErr } = await admin
    .from("eventos")
    .select("id, slug, ativo, publicado")
    .eq("id", v.evento_id)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  if (!evento?.slug || !evento.ativo || !evento.publicado) {
    return { mode: "sem_evento", qr: qrRow, motivo: "sorteio_indisponivel" };
  }

  const sorteio = await fetchPublicSorteioByEventoSlug(evento.slug as string);
  if (!sorteio) {
    return { mode: "sem_evento", qr: qrRow, motivo: "sorteio_indisponivel" };
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

  // Desativa vínculos ativos deste evento (troca de QR)
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
