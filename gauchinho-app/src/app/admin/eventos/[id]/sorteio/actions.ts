"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchEventoAdmin } from "@/app/admin/eventos/actions";
import { DEFAULTS_SORTEIO, type SorteioStatus } from "@/lib/eventos-sorteio/types";
import { filtrarElegiveisSorteio } from "@/lib/eventos-sorteio/sorteio";
import { isDbMissingRelationError } from "@/lib/comercial-eventos/db-ready";

function boolForm(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function strForm(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function intForm(formData: FormData, name: string, fallback: number): number {
  const raw = strForm(formData, name);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function assertEventoAccess(eventoId: string) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");
  await fetchEventoAdmin(eventoId);
  return u;
}

export async function saveSorteioConfigAction(eventoId: string, formData: FormData) {
  await assertEventoAccess(eventoId);
  const admin = createAdminClient();

  const payload = {
    evento_id: eventoId,
    ativo: boolForm(formData, "ativo"),
    titulo: strForm(formData, "titulo") || DEFAULTS_SORTEIO.titulo,
    descricao: strForm(formData, "descricao") || DEFAULTS_SORTEIO.descricao,
    texto_agradecimento: strForm(formData, "texto_agradecimento") || DEFAULTS_SORTEIO.texto_agradecimento,
    quantidade_brindes: intForm(formData, "quantidade_brindes", 1),
    mostrar_home: boolForm(formData, "mostrar_home"),
    permitir_telefone_duplicado: boolForm(formData, "permitir_telefone_duplicado"),
    status: (strForm(formData, "status") === "encerrado" ? "encerrado" : "aberto") as SorteioStatus,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await admin.from("eventos_sorteios").select("id").eq("evento_id", eventoId).maybeSingle();

  if (existing?.id) {
    const { error } = await admin.from("eventos_sorteios").update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from("eventos_sorteios").insert({ ...payload, ativo: payload.ativo });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/admin/eventos/${eventoId}/sorteio`);
  revalidatePath(`/admin/eventos/${eventoId}`);
  revalidatePath("/");
}

export async function updateParticipanteSorteioAction(
  eventoId: string,
  participanteId: string,
  patch: { ganhador?: boolean; status?: "participando" | "cancelado" },
) {
  await assertEventoAccess(eventoId);
  const admin = createAdminClient();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.ganhador !== undefined) {
    row.ganhador = patch.ganhador;
    row.sorteado_em = patch.ganhador ? new Date().toISOString() : null;
  }
  if (patch.status) row.status = patch.status;

  const { error } = await admin
    .from("eventos_sorteio_participantes")
    .update(row)
    .eq("id", participanteId)
    .eq("evento_id", eventoId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/eventos/${eventoId}/sorteio`);
}

export async function confirmarVencedorSorteioAction(
  eventoId: string,
  sorteioId: string,
  participanteId: string,
) {
  await assertEventoAccess(eventoId);
  const admin = createAdminClient();

  const { data: part, error: partErr } = await admin
    .from("eventos_sorteio_participantes")
    .select("id, codigo, nome, sorteio_id, evento_id, status, ganhador")
    .eq("id", participanteId)
    .eq("sorteio_id", sorteioId)
    .eq("evento_id", eventoId)
    .maybeSingle();
  if (partErr || !part) throw new Error(partErr?.message ?? "Participante não encontrado.");
  if (part.status !== "participando") throw new Error("Participante não está ativo.");
  if (part.ganhador) throw new Error("Participante já é ganhador.");

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("eventos_sorteio_participantes")
    .update({ ganhador: true, sorteado_em: now, updated_at: now })
    .eq("id", participanteId);
  if (updErr) throw new Error(updErr.message);

  const { count } = await admin
    .from("eventos_sorteio_resultados")
    .select("id", { count: "exact", head: true })
    .eq("sorteio_id", sorteioId);

  const ordem = (count ?? 0) + 1;
  const { error: resErr } = await admin.from("eventos_sorteio_resultados").insert({
    sorteio_id: sorteioId,
    evento_id: eventoId,
    participante_id: participanteId,
    codigo: part.codigo,
    nome: part.nome,
    ordem,
  });
  if (resErr) throw new Error(resErr.message);

  revalidatePath(`/admin/eventos/${eventoId}/sorteio`);
}

export type SorteioDrawCandidate = {
  id: string;
  codigo: string;
  nome: string;
  telefone: string;
  status: "participando" | "cancelado";
  ganhador: boolean;
};

export async function listDrawCandidatesAction(
  eventoId: string,
  sorteioId: string,
): Promise<SorteioDrawCandidate[]> {
  await assertEventoAccess(eventoId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos_sorteio_participantes")
    .select("id, codigo, nome, telefone, status, ganhador")
    .eq("sorteio_id", sorteioId)
    .eq("evento_id", eventoId);
  if (error) {
    if (isDbMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return filtrarElegiveisSorteio((data ?? []) as SorteioDrawCandidate[]);
}

export async function exportParticipantesCsvAction(eventoId: string, sorteioId: string): Promise<string> {
  await assertEventoAccess(eventoId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos_sorteio_participantes")
    .select("*")
    .eq("sorteio_id", sorteioId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const header = [
    "codigo",
    "nome",
    "telefone",
    "tipo_sonho",
    "valor_mensal_disponivel",
    "quem_convidou",
    "status",
    "ganhador",
    "created_at",
  ];
  const lines = [header.join(";")];
  for (const row of data ?? []) {
    lines.push(
      [
        row.codigo,
        row.nome,
        row.telefone,
        row.tipo_sonho ?? "",
        row.valor_mensal_disponivel ?? "",
        row.quem_convidou ?? "",
        row.status,
        row.ganhador ? "sim" : "nao",
        row.created_at,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
  }
  return lines.join("\n");
}

export async function redirectSorteioAdmin(eventoId: string) {
  redirect(`/admin/eventos/${eventoId}/sorteio`);
}
