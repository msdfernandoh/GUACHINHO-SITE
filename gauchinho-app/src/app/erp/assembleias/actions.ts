"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { erpOperationalRouteEnabled } from "@/lib/erp/erp-operational";

async function requireAssembleias(write = false) {
  const { usuario, vinculos, empresaAtiva } = await getCurrentTenantContext();
  if (!usuario || !empresaAtiva || !vinculos.some((v) => v.empresa_id === empresaAtiva.id)) {
    throw new Error("Tenant não autorizado.");
  }
  const config = getErpSistemaConfig(empresaAtiva.configuracoes);
  if (!erpOperationalRouteEnabled(config, "assembleias")) throw new Error("Módulo não habilitado.");
  const supabase = await createClient();
  if (write) {
    const { data, error } = await supabase.rpc("can_write_tenant_internal", { p_empresa_id: empresaAtiva.id });
    if (error || data !== true) throw new Error("Sem permissão para alterar assembleias.");
  }
  return { supabase, empresaId: empresaAtiva.id, usuarioId: usuario.id };
}

export async function createAssembleiaAction(formData: FormData) {
  const { supabase, empresaId, usuarioId } = await requireAssembleias(true);
  const grupoId = String(formData.get("grupo_id") ?? "").trim();
  const dataAssembleia = String(formData.get("data_assembleia") ?? "").trim();
  const pedra = Number(formData.get("pedra_sorteada"));
  const numeroRaw = String(formData.get("numero_assembleia") ?? "").trim();
  if (!grupoId || !/^\d{4}-\d{2}-\d{2}$/.test(dataAssembleia)) throw new Error("Grupo e data são obrigatórios.");
  if (!Number.isSafeInteger(pedra) || pedra < 0) throw new Error("Pedra sorteada inválida.");
  const numero = numeroRaw ? Number(numeroRaw) : null;
  if (numero != null && (!Number.isSafeInteger(numero) || numero <= 0)) throw new Error("Número da assembleia inválido.");
  const { error } = await supabase.from("erp_assembleias_grupo").insert({
    empresa_id: empresaId,
    grupo_id: grupoId,
    data_assembleia: dataAssembleia,
    numero_assembleia: numero,
    pedra_sorteada: pedra,
    observacao: String(formData.get("observacao") ?? "").trim() || null,
    criado_por_usuario_id: usuarioId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/assembleias");
}

export async function toggleAtencaoAssembleiaAction(formData: FormData) {
  const { supabase, empresaId, usuarioId } = await requireAssembleias(true);
  const assembleiaId = String(formData.get("assembleia_id") ?? "");
  const cotaId = String(formData.get("cota_id") ?? "");
  const marcada = String(formData.get("marcada") ?? "") === "true";
  if (!assembleiaId || !cotaId) throw new Error("Assembleia e cota são obrigatórias.");
  if (marcada) {
    const { error } = await supabase.from("erp_assembleia_atencoes").delete().eq("empresa_id", empresaId).eq("assembleia_id", assembleiaId).eq("cota_definitiva_id", cotaId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("erp_assembleia_atencoes").insert({ empresa_id: empresaId, assembleia_id: assembleiaId, cota_definitiva_id: cotaId, marcado_por_usuario_id: usuarioId });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/erp/assembleias");
}
