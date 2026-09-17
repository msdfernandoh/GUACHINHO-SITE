"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { listGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { buscarPrimeiroPremioFederalPorData } from "@/lib/grupos-sorteio/buscar-resultado-federal";
import {
  calcularPedraPorLoteriaFederal,
  validarPrimeiroPremioFederal,
} from "@/lib/erp/assembleias";

async function requireAssembleias(write = false) {
  const { usuario, empresaAtiva } = await requireErpRouteAccess("assembleias");
  const supabase = await createClient();
  if (write) {
    const { data, error } = await supabase.rpc("can_write_tenant_internal", { p_empresa_id: empresaAtiva.id });
    if (error || data !== true) throw new Error("Sem permissão para alterar assembleias.");
  }
  return { supabase, empresaId: empresaAtiva.id, usuarioId: usuario.id };
}

export async function buscarResultadoFederalAction(dataSorteio: string) {
  await requireAssembleias(false);
  const limpa = String(dataSorteio ?? "").trim();
  if (!limpa) throw new Error("Informe a data do sorteio.");
  return await buscarPrimeiroPremioFederalPorData(limpa);
}

export async function createAssembleiaAction(formData: FormData) {
  const { supabase, empresaId, usuarioId } = await requireAssembleias(true);
  const grupoId = String(formData.get("grupo_id") ?? "").trim();
  const dataAssembleia = String(formData.get("data_assembleia") ?? "").trim();
  const numeroRaw = String(formData.get("numero_assembleia") ?? "").trim();
  const primeiroPremio = String(formData.get("primeiro_premio_federal") ?? "").trim();
  const modo = String(formData.get("modo") ?? "").trim() || (primeiroPremio ? "FEDERAL" : "MANUAL");

  if (!grupoId || !/^\d{4}-\d{2}-\d{2}$/.test(dataAssembleia)) throw new Error("Grupo e data são obrigatórios.");
  const numero = numeroRaw ? Number(numeroRaw) : null;
  if (numero != null && (!Number.isSafeInteger(numero) || numero <= 0)) throw new Error("Número da assembleia inválido.");
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  const gruposAutorizados = await listGruposAutorizadosForEmpresa(empresaId);
  if (!gruposAutorizados || gruposAutorizados.length === 0) {
    throw new Error("Nenhum grupo autorizado disponível para este tenant.");
  }

  const isTodos = grupoId === "TODOS" || grupoId === "TODOS_GRUPOS";

  if (modo === "FEDERAL" || primeiroPremio) {
    if (!validarPrimeiroPremioFederal(primeiroPremio)) {
      throw new Error("O 1º Prêmio da Loteria Federal deve conter exatamente 5 dígitos numéricos.");
    }

    if (isTodos) {
      const rows = gruposAutorizados.map((g) => {
        const cotas =
          g.quantidade_cotas_sorteio && Number(g.quantidade_cotas_sorteio) > 0
            ? Number(g.quantidade_cotas_sorteio)
            : g.modalidade?.toLowerCase().includes("imov")
            ? 999
            : 2000;
        const pedraCalculada = calcularPedraPorLoteriaFederal(primeiroPremio, cotas);
        return {
          empresa_id: empresaId,
          grupo_id: g.id,
          data_assembleia: dataAssembleia,
          numero_assembleia: numero,
          pedra_sorteada: pedraCalculada,
          observacao:
            observacao ||
            `Loteria Federal (1º Prêmio ${primeiroPremio}) · ${g.codigo_grupo} (${cotas} cotas)`,
          criado_por_usuario_id: usuarioId,
        };
      });
      const { error } = await supabase.from("erp_assembleias_grupo").insert(rows);
      if (error) throw new Error(error.message);
    } else {
      const g = gruposAutorizados.find((x) => x.id === grupoId);
      const cotas =
        g?.quantidade_cotas_sorteio && Number(g.quantidade_cotas_sorteio) > 0
          ? Number(g.quantidade_cotas_sorteio)
          : g?.modalidade?.toLowerCase().includes("imov")
          ? 999
          : 2000;
      const pedraCalculada = calcularPedraPorLoteriaFederal(primeiroPremio, cotas);
      const { error } = await supabase.from("erp_assembleias_grupo").insert({
        empresa_id: empresaId,
        grupo_id: grupoId,
        data_assembleia: dataAssembleia,
        numero_assembleia: numero,
        pedra_sorteada: pedraCalculada,
        observacao:
          observacao ||
          `Loteria Federal (1º Prêmio ${primeiroPremio}) · ${g?.codigo_grupo ?? ""} (${cotas} cotas)`,
        criado_por_usuario_id: usuarioId,
      });
      if (error) throw new Error(error.message);
    }
  } else {
    // Modo Manual direto com pedra_sorteada fixa
    const pedra = Number(formData.get("pedra_sorteada"));
    if (!Number.isSafeInteger(pedra) || pedra < 0) throw new Error("Pedra sorteada inválida.");

    if (isTodos) {
      const rows = gruposAutorizados.map((g) => ({
        empresa_id: empresaId,
        grupo_id: g.id,
        data_assembleia: dataAssembleia,
        numero_assembleia: numero,
        pedra_sorteada: pedra,
        observacao,
        criado_por_usuario_id: usuarioId,
      }));
      const { error } = await supabase.from("erp_assembleias_grupo").insert(rows);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("erp_assembleias_grupo").insert({
        empresa_id: empresaId,
        grupo_id: grupoId,
        data_assembleia: dataAssembleia,
        numero_assembleia: numero,
        pedra_sorteada: pedra,
        observacao,
        criado_por_usuario_id: usuarioId,
      });
      if (error) throw new Error(error.message);
    }
  }

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
