"use server";

import {
  consultarCheckinExistente,
  executarCheckinConversacional,
  type QualificacaoRespostasPayload,
} from "@/lib/eventos-sorteio/checkin-conversacional";
import { salvarIndicacaoSorteio } from "@/lib/eventos-sorteio/indicacoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { digitsOnlyPhone } from "@/lib/utils/format";

export async function consultarCheckinAction(eventoId: string, whatsapp: string) {
  return consultarCheckinExistente(eventoId, whatsapp);
}

export async function submeterCheckinConversacionalAction(params: {
  eventoId: string;
  nome: string;
  whatsapp: string;
  qualificacao: QualificacaoRespostasPayload;
  qrCodeUnicoId?: string | null;
  lgpdVersao?: string;
}) {
  return executarCheckinConversacional(params);
}

/**
 * Indicação feita na tela final do check-in: localiza o cupom principal de quem
 * fez o check-in (evento + WhatsApp) e registra o indicado, que vira lead e gera
 * 1 cupom extra para quem indicou.
 */
export async function indicarAmigoCheckinAction(params: {
  eventoId: string;
  whatsappIndicador: string;
  nome: string;
  telefone: string;
}): Promise<{ ok: true; codigoExtra: string | null; aviso: string | null } | { ok: false; error: string }> {
  const tel = digitsOnlyPhone(params.whatsappIndicador ?? "");
  if (!params.eventoId || tel.length < 10) return { ok: false, error: "Faça o check-in antes de indicar." };
  const { data } = await createAdminClient()
    .from("eventos_sorteio_participantes")
    .select("id, telefone")
    .eq("evento_id", params.eventoId)
    .eq("origem_cupom", "cadastro")
    .eq("status", "participando");
  const principal = (data ?? []).find((r) => digitsOnlyPhone(String(r.telefone)) === tel);
  if (!principal) return { ok: false, error: "Não encontramos seu check-in. Recarregue a página e tente de novo." };
  const r = await salvarIndicacaoSorteio(principal.id as string, {
    nome: params.nome,
    telefone: params.telefone,
    tipo: "amigo",
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, codigoExtra: r.codigoExtra, aviso: r.aviso };
}
