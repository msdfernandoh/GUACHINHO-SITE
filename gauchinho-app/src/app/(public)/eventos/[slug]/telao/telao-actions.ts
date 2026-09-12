"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { filtrarElegiveisSorteio } from "@/lib/eventos-sorteio/sorteio";
import { listPremiosEvento, type EventoPremioRow } from "@/lib/eventos-sorteio/premios";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { isStaff } from "@/lib/auth/permissions";

export type TelaoData = {
  eventoId: string;
  eventoNome: string;
  eventoSlug: string;
  corPrimaria: string | null;
  corSecundaria: string | null;
  logoPersonalizadoUrl: string | null;
  sorteioId: string | null;
  premios: EventoPremioRow[];
  participantesElegiveis: Array<{ id: string; codigo: string; nome: string; telefone: string }>;
  ganhadores: Array<{ id: string; codigo: string; nome: string; ordem: number; premioTitulo?: string | null }>;
};

export async function fetchEventoTelaoData(slug: string): Promise<TelaoData | null> {
  const admin = createAdminClient();
  const normalized = slug.trim().toLowerCase();

  const { data: evento, error: evErr } = await admin
    .from("eventos")
    .select("id, nome, slug, cor_primaria, cor_secundaria, logo_personalizado_url")
    .ilike("slug", normalized)
    .eq("ativo", true)
    .maybeSingle();

  if (evErr || !evento) return null;

  const { data: sorteio } = await admin
    .from("eventos_sorteios")
    .select("id")
    .eq("evento_id", evento.id)
    .maybeSingle();

  const sorteioId = sorteio?.id as string | null;

  let participantesElegiveis: Array<{ id: string; codigo: string; nome: string; telefone: string }> = [];
  let ganhadores: Array<{ id: string; codigo: string; nome: string; ordem: number; premioTitulo?: string | null }> = [];

  if (sorteioId) {
    const { data: partRows } = await admin
      .from("eventos_sorteio_participantes")
      .select("id, codigo, nome, telefone, status, ganhador")
      .eq("evento_id", evento.id)
      .eq("sorteio_id", sorteioId)
      .eq("status", "participando");

    const elegiveis = filtrarElegiveisSorteio(
      (partRows ?? []).map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        telefone: p.telefone,
        status: p.status as "participando",
        ganhador: Boolean(p.ganhador),
      })),
    );

    participantesElegiveis = elegiveis.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      telefone: p.telefone,
    }));

    const { data: resRows } = await admin
      .from("eventos_sorteio_resultados")
      .select("id, codigo, nome, ordem")
      .eq("sorteio_id", sorteioId)
      .order("ordem", { ascending: true });

    ganhadores = (resRows ?? []).map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nome: r.nome,
      ordem: r.ordem,
    }));
  }

  const premios = await listPremiosEvento(evento.id);

  return {
    eventoId: evento.id,
    eventoNome: evento.nome,
    eventoSlug: evento.slug,
    corPrimaria: evento.cor_primaria,
    corSecundaria: evento.cor_secundaria,
    logoPersonalizadoUrl: evento.logo_personalizado_url,
    sorteioId,
    premios,
    participantesElegiveis,
    ganhadores,
  };
}

export async function confirmarGanhadorTelaoAction(params: {
  eventoId: string;
  sorteioId: string;
  participanteId: string;
  premioId?: string | null;
}) {
  let usuario;
  try {
    usuario = await requireUsuario();
  } catch {
    return { ok: false, error: "Apenas organizadores do evento podem confirmar ganhadores." };
  }

  if (!isStaff(usuario.perfil)) {
    return { ok: false, error: "Apenas organizadores do evento podem confirmar ganhadores." };
  }

  const admin = createAdminClient();

  // Tenta pela RPC atômica com prêmio
  try {
    const { data: rpcData, error: rpcErr } = await admin.rpc("rpc_confirmar_ganhador_com_premio", {
      p_evento_id: params.eventoId,
      p_sorteio_id: params.sorteioId,
      p_participante_id: params.participanteId,
      p_premio_id: params.premioId || null,
    });
    if (!rpcErr && rpcData && typeof rpcData === "object") {
      const r = rpcData as { ok?: boolean; codigo?: string; nome?: string; ordem?: number; error?: string };
      if (r.ok) return { ok: true, codigo: r.codigo, nome: r.nome, ordem: r.ordem };
      if (r.error) return { ok: false, error: r.error };
    }
  } catch (err) {
    console.warn("[telao-actions] RPC fallback:", err);
  }

  // Fallback JS
  const { data: part } = await admin
    .from("eventos_sorteio_participantes")
    .select("id, codigo, nome, telefone")
    .eq("id", params.participanteId)
    .single();
  if (!part) return { ok: false, error: "Participante não encontrado" };

  const norm = part.telefone.replace(/\D/g, "");
  const now = new Date().toISOString();

  // 1. Vincula ao prêmio primeiro se fornecido (apenas se pendente - trava atômica)
  if (params.premioId) {
    const { data: premioAtualizado, error: premioErr } = await admin
      .from("eventos_premios")
      .update({
        status: "sorteado",
        ganhador_participante_id: params.participanteId,
        sorteado_at: now,
        updated_at: now,
      })
      .eq("id", params.premioId)
      .eq("evento_id", params.eventoId)
      .eq("status", "pendente")
      .select("id, titulo")
      .maybeSingle();

    if (premioErr || !premioAtualizado) {
      return { ok: false, error: "Este prêmio já foi sorteado." };
    }
  }

  // 2. Marca participante como ganhador
  await admin
    .from("eventos_sorteio_participantes")
    .update({ ganhador: true, sorteado_em: now, updated_at: now })
    .eq("evento_id", params.eventoId)
    .ilike("telefone", `%${norm}%`);

  const { count } = await admin
    .from("eventos_sorteio_resultados")
    .select("id", { count: "exact", head: true })
    .eq("sorteio_id", params.sorteioId);

  const ordem = (count ?? 0) + 1;
  await admin.from("eventos_sorteio_resultados").insert({
    sorteio_id: params.sorteioId,
    evento_id: params.eventoId,
    participante_id: params.participanteId,
    codigo: part.codigo,
    nome: part.nome,
    ordem,
  });

  return { ok: true, codigo: part.codigo, nome: part.nome, ordem };
}
