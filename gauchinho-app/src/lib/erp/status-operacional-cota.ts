import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function registrarStatusOperacionalCota({
  empresaId, usuarioId, cotaId, status, tela, statusAnterior,
}: {
  empresaId: string;
  usuarioId: string | null;
  cotaId: string;
  status: "contemplada" | "cancelada";
  tela: string;
  statusAnterior?: string;
}) {
  const adminSupabase = createAdminClient();
  const { data: cota, error: cotaError } = await adminSupabase
    .from("cotas_definitivas")
    .select("id, empresa_id, status, contemplada")
    .eq("id", cotaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (cotaError) throw new Error(cotaError.message);
  if (!cota) throw new Error("Cota não encontrada para a empresa ativa.");

  const novoStatus = status === "contemplada" ? "contemplada" : "cancelada";
  let atualizacao = adminSupabase
    .from("cotas_definitivas")
    .update({ status: novoStatus, contemplada: status === "contemplada" })
    .eq("id", cotaId)
    .eq("empresa_id", empresaId);
  if (statusAnterior != null) atualizacao = atualizacao.eq("status", statusAnterior);
  const { data: cotaAtualizada, error: updateCotaError } = await atualizacao
    .select("id,status,contemplada")
    .maybeSingle();

  if (updateCotaError) throw new Error(updateCotaError.message);
  if (!cotaAtualizada || cotaAtualizada.status !== novoStatus) {
    throw new Error("O status da cota não foi confirmado após a atualização.");
  }

  const { data: estrategia, error: estrategiaError } = await adminSupabase
    .from("cota_estrategias_lance")
    .select("id, ativa")
    .eq("cota_definitiva_id", cotaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (estrategiaError) throw new Error(estrategiaError.message);

  if (estrategia) {
    const { error: estrategiaUpdateError } = await adminSupabase
      .from("cota_estrategias_lance")
      .update({ ativa: false })
      .eq("id", estrategia.id)
      .eq("empresa_id", empresaId);

    if (estrategiaUpdateError) throw new Error(estrategiaUpdateError.message);

    const { error: historicoError } = await adminSupabase.from("cota_estrategias_lance_historico").insert({
      empresa_id: empresaId,
      estrategia_id: estrategia.id,
      cota_definitiva_id: cotaId,
      estado_anterior: { ativa: estrategia.ativa },
      estado_novo: { ativa: false, status_cota: novoStatus },
      motivo: `Cota marcada como ${status} na tela de ${tela}`,
      usuario_id: usuarioId,
    });

    if (historicoError) throw new Error(historicoError.message);
  }
}
