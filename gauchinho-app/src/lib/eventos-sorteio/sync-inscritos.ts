import { createAdminClient } from "@/lib/supabase/admin";
import { proximoCodigoFromExisting } from "./codigo";
import type { SorteioParticipanteRow } from "./types";

function telefoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const STATUS_EVENTO_ELEGIVEL = new Set(["confirmado", "presente", "lista_espera"]);

export function mapStatusEventoParaSorteio(status: string): "participando" | "cancelado" {
  if (STATUS_EVENTO_ELEGIVEL.has(status)) return "participando";
  return "cancelado";
}

type EventoParticipanteRow = {
  id: string;
  evento_id: string;
  lead_id: string | null;
  nome_participante: string;
  telefone_participante: string;
  nome_convidou: string | null;
  empresa_convidou: string | null;
  observacao: string | null;
  status: string;
};

/** Garante que inscrições oficiais do evento existam em eventos_sorteio_participantes. */
export async function syncInscritosEventoParaSorteio(
  eventoId: string,
  sorteioId: string,
): Promise<void> {
  const admin = createAdminClient();

  const { data: inscritos, error: insErr } = await admin
    .from("eventos_participantes")
    .select(
      "id, evento_id, lead_id, nome_participante, telefone_participante, nome_convidou, empresa_convidou, observacao, status",
    )
    .eq("evento_id", eventoId);
  if (insErr) throw new Error(insErr.message);

  const { data: sorteioRows, error: sortErr } = await admin
    .from("eventos_sorteio_participantes")
    .select("id, codigo, evento_participante_id, telefone, ganhador, sorteado_em")
    .eq("sorteio_id", sorteioId)
    .eq("evento_id", eventoId);
  if (sortErr) throw new Error(sortErr.message);

  const byInscricaoId = new Map(
    (sorteioRows ?? [])
      .filter((r) => r.evento_participante_id)
      .map((r) => [r.evento_participante_id as string, r]),
  );
  const codigosUsados = (sorteioRows ?? []).map((r) => r.codigo as string);

  for (const ins of (inscritos ?? []) as EventoParticipanteRow[]) {
    const statusSorteio = mapStatusEventoParaSorteio(ins.status);
    const quemConvidou = [ins.nome_convidou, ins.empresa_convidou].filter(Boolean).join(" · ") || null;
    const observacao = ins.observacao?.trim() || null;
    const telefone = telefoneDigits(ins.telefone_participante) || ins.telefone_participante.trim();

    const linked = byInscricaoId.get(ins.id);
    if (linked?.id) {
      await admin
        .from("eventos_sorteio_participantes")
        .update({
          nome: ins.nome_participante.trim(),
          telefone,
          quem_convidou: quemConvidou,
          observacao,
          status: statusSorteio,
          lead_id: ins.lead_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", linked.id);
      continue;
    }

    const codigo = proximoCodigoFromExisting(codigosUsados);
    codigosUsados.push(codigo);

    const { error: insertErr } = await admin.from("eventos_sorteio_participantes").insert({
      sorteio_id: sorteioId,
      evento_id: eventoId,
      evento_participante_id: ins.id,
      lead_id: ins.lead_id,
      codigo,
      nome: ins.nome_participante.trim(),
      telefone,
      quem_convidou: quemConvidou,
      observacao,
      status: statusSorteio,
      ganhador: false,
    });
    if (insertErr) throw new Error(insertErr.message);
  }
}

/** Lista do admin: inscrições oficiais do evento (+ cadastros só pelo QR, se não houver inscritos). */
export async function fetchParticipantesSorteioAdmin(
  sorteioId: string,
  eventoId: string,
): Promise<SorteioParticipanteRow[]> {
  await syncInscritosEventoParaSorteio(eventoId, sorteioId);

  const admin = createAdminClient();
  const { data: inscritos, error: insErr } = await admin
    .from("eventos_participantes")
    .select("id")
    .eq("evento_id", eventoId);
  if (insErr) throw new Error(insErr.message);

  const temInscritos = (inscritos ?? []).length > 0;

  let q = admin
    .from("eventos_sorteio_participantes")
    .select("*")
    .eq("sorteio_id", sorteioId)
    .eq("evento_id", eventoId);

  if (temInscritos) {
    q = q.not("evento_participante_id", "is", null);
  }

  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SorteioParticipanteRow[];
}
