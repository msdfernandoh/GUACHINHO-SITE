"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { createClient } from "@/lib/supabase/server";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";

export async function confirmarRecebimentoNoAppAction(previsaoId: string) {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) return { ok: false, error: "Sua sessão expirou." };
  const db = await createClient();
  const { participante, indicador } = await resolveIndicadorAppSession(empresaAtiva.id, usuario.id);
  if (!participante || !indicador) return { ok: false, error: "Participante não localizado." };
  const { data: previsao } = await db
    .from("comissao_previsoes_participantes")
    .select("id")
    .eq("id", previsaoId)
    .eq("empresa_id", empresaAtiva.id)
    .eq("participante_comercial_id", participante.id)
    .maybeSingle();
  if (!previsao) return { ok: false, error: "Comissão não localizada." };
  const { error } = await db.rpc("rpc_conferir_pagamento_participante", {
    p_empresa_id: empresaAtiva.id,
    p_previsao_participante_id: previsaoId,
  });
  if (error) return { ok: false, error: "Não foi possível confirmar o recebimento." };
  revalidatePath("/app-indicador");
  revalidatePath("/app-indicador/comissoes");
  return { ok: true };
}
