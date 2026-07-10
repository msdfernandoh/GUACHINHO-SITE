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

export function mapStatusSorteioParaEvento(status: string): string {
  return status === "participando" ? "confirmado" : "cancelado";
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

type SorteioRowLite = {
  id: string;
  codigo: string;
  evento_participante_id: string | null;
  telefone: string;
  ganhador: boolean;
  sorteado_em: string | null;
  tipo_sonho: string | null;
  valor_mensal_disponivel: number | null;
  lead_id: string | null;
  nome: string;
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

/**
 * Cadastros pelo QR (sem evento_participante_id) voltam a aparecer no admin e ganham
 * inscrição em Participantes do evento (ou vínculo por telefone, preservando ganhadores).
 */
export async function syncSorteioOrfaosParaInscricaoEvento(
  eventoId: string,
  sorteioId: string,
): Promise<void> {
  const admin = createAdminClient();

  const { data: orfaos, error: orfErr } = await admin
    .from("eventos_sorteio_participantes")
    .select(
      "id, codigo, nome, telefone, lead_id, observacao, status, ganhador, sorteado_em, tipo_sonho, valor_mensal_disponivel, evento_participante_id",
    )
    .eq("sorteio_id", sorteioId)
    .eq("evento_id", eventoId)
    .is("evento_participante_id", null);
  if (orfErr) throw new Error(orfErr.message);
  if (!orfaos?.length) return;

  const { data: inscritos, error: insErr } = await admin
    .from("eventos_participantes")
    .select("id, telefone_participante")
    .eq("evento_id", eventoId);
  if (insErr) throw new Error(insErr.message);

  const inscricaoIdPorTelefone = new Map<string, string>();
  for (const ins of inscritos ?? []) {
    const d = telefoneDigits(ins.telefone_participante);
    if (d && !inscricaoIdPorTelefone.has(d)) inscricaoIdPorTelefone.set(d, ins.id);
  }

  const { data: vinculados, error: vinErr } = await admin
    .from("eventos_sorteio_participantes")
    .select("id, evento_participante_id, ganhador, tipo_sonho, valor_mensal_disponivel, sorteado_em")
    .eq("sorteio_id", sorteioId)
    .not("evento_participante_id", "is", null);
  if (vinErr) throw new Error(vinErr.message);

  const sorteioPorInscricao = new Map(
    (vinculados ?? [])
      .filter((r) => r.evento_participante_id)
      .map((r) => [r.evento_participante_id as string, r]),
  );

  for (const orf of orfaos as SorteioRowLite[]) {
    const tel = telefoneDigits(orf.telefone);
    const inscricaoId = tel ? inscricaoIdPorTelefone.get(tel) : undefined;

    if (inscricaoId) {
      const existente = sorteioPorInscricao.get(inscricaoId);
      if (existente?.id && existente.id !== orf.id) {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (orf.ganhador && !existente.ganhador) {
          patch.ganhador = true;
          patch.sorteado_em = orf.sorteado_em ?? new Date().toISOString();
        }
        if (orf.tipo_sonho && !existente.tipo_sonho) patch.tipo_sonho = orf.tipo_sonho;
        if (orf.valor_mensal_disponivel != null && existente.valor_mensal_disponivel == null) {
          patch.valor_mensal_disponivel = orf.valor_mensal_disponivel;
        }
        if (Object.keys(patch).length > 1) {
          await admin.from("eventos_sorteio_participantes").update(patch).eq("id", existente.id);
        }
        await admin.from("eventos_sorteio_participantes").delete().eq("id", orf.id);
      } else {
        await admin
          .from("eventos_sorteio_participantes")
          .update({
            evento_participante_id: inscricaoId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orf.id);
        sorteioPorInscricao.set(inscricaoId, {
          id: orf.id,
          evento_participante_id: inscricaoId,
          ganhador: orf.ganhador,
          tipo_sonho: orf.tipo_sonho,
          valor_mensal_disponivel: orf.valor_mensal_disponivel,
          sorteado_em: orf.sorteado_em,
        });
      }
      continue;
    }

    const { data: novo, error: insertErr } = await admin
      .from("eventos_participantes")
      .insert({
        evento_id: eventoId,
        lead_id: orf.lead_id,
        nome_participante: orf.nome.trim(),
        telefone_participante: orf.telefone.trim(),
        observacao: orf.observacao?.trim() || "Inscrição via formulário do sorteio (QR)",
        status: mapStatusSorteioParaEvento(orf.status),
        quantidade_vagas: 1,
      })
      .select("id")
      .single();
    if (insertErr || !novo) throw new Error(insertErr?.message ?? "Falha ao criar participante do evento.");

    if (tel) inscricaoIdPorTelefone.set(tel, novo.id);

    await admin
      .from("eventos_sorteio_participantes")
      .update({
        evento_participante_id: novo.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orf.id);
  }
}

/** Cria ou vincula inscrição do evento para um participante recém-cadastrado no sorteio (QR). */
export async function vincularNovoCadastroSorteioAoEvento(
  eventoId: string,
  sorteioId: string,
  sorteioParticipanteId: string,
  nome: string,
  telefone: string,
  leadId: string,
  statusSorteio: "participando" | "cancelado",
): Promise<void> {
  const admin = createAdminClient();
  const tel = telefoneDigits(telefone);

  const { data: inscritos, error: insErr } = await admin
    .from("eventos_participantes")
    .select("id, telefone_participante")
    .eq("evento_id", eventoId);
  if (insErr) throw new Error(insErr.message);

  let inscricaoId: string | null = null;
  for (const ins of inscritos ?? []) {
    if (tel && telefoneDigits(ins.telefone_participante) === tel) {
      inscricaoId = ins.id;
      break;
    }
  }

  if (!inscricaoId) {
    const { data: novo, error: insErr } = await admin
      .from("eventos_participantes")
      .insert({
        evento_id: eventoId,
        lead_id: leadId,
        nome_participante: nome.trim(),
        telefone_participante: telefone.trim(),
        observacao: "Inscrição via formulário do sorteio (QR)",
        status: mapStatusSorteioParaEvento(statusSorteio),
        quantidade_vagas: 1,
      })
      .select("id")
      .single();
    if (insErr || !novo) throw new Error(insErr?.message ?? "Falha ao registrar participante do evento.");
    inscricaoId = novo.id;
  }

  const { error: linkErr } = await admin
    .from("eventos_sorteio_participantes")
    .update({
      evento_participante_id: inscricaoId,
      lead_id: leadId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sorteioParticipanteId);
  if (linkErr) {
    if (/eventos_sorteio_participantes_inscricao_unique|duplicate key/i.test(linkErr.message)) {
      const { data: outro } = await admin
        .from("eventos_sorteio_participantes")
        .select("id")
        .eq("sorteio_id", sorteioId)
        .eq("evento_participante_id", inscricaoId)
        .neq("id", sorteioParticipanteId)
        .maybeSingle();
      if (outro?.id) {
        await admin.from("eventos_sorteio_participantes").delete().eq("id", sorteioParticipanteId);
        return;
      }
    }
    throw new Error(linkErr.message);
  }
}

/** Lista do admin: inscrições do evento + cadastros pelo QR (todos visíveis). */
export async function fetchParticipantesSorteioAdmin(
  sorteioId: string,
  eventoId: string,
): Promise<SorteioParticipanteRow[]> {
  await syncInscritosEventoParaSorteio(eventoId, sorteioId);
  await syncSorteioOrfaosParaInscricaoEvento(eventoId, sorteioId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos_sorteio_participantes")
    .select("*")
    .eq("sorteio_id", sorteioId)
    .eq("evento_id", eventoId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SorteioParticipanteRow[];
}
