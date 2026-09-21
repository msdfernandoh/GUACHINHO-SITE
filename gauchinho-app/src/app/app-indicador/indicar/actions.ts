"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { digitsOnlyPhone } from "@/lib/utils/format";
import { upsertLeadPorTelefone } from "@/lib/crm/upsert-lead";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";

export type NovaIndicacaoApp = {
  nome: string;
  telefone: string;
  relacao: "AMIGO" | "FAMILIAR" | "CLIENTE" | "OUTROS";
  relacaoOutro?: string;
  produto: "IMOVEL" | "VEICULO" | "MOTO" | "FROTA";
  credito: number;
  capacidadeMensal: number;
  observacao?: string;
};

export async function registrarIndicacaoDoAppAction(input: NovaIndicacaoApp) {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  const nome = input.nome.trim();
  const telefone = digitsOnlyPhone(input.telefone);
  if (nome.length < 3 || telefone.length < 10) {
    return { ok: false, error: "Informe nome completo e telefone com DDD." };
  }
  if (!input.relacao || !input.produto || !Number.isFinite(input.credito) || input.credito <= 0 || !Number.isFinite(input.capacidadeMensal) || input.capacidadeMensal <= 0) {
    return { ok: false, error: "Complete as opções da indicação para continuar." };
  }
  if (input.relacao === "OUTROS" && !input.relacaoOutro?.trim()) {
    return { ok: false, error: "Explique a relação com a pessoa indicada." };
  }

  const admin = createAdminClient();
  const { participante, indicador } = await resolveIndicadorAppSession(empresaAtiva.id, usuario.id);
  if (!participante) return { ok: false, error: "Seu acesso não está vinculado a um indicador ativo." };
  if (!indicador) return { ok: false, error: "Seu cadastro de indicador não foi localizado." };

  const relacao = input.relacao === "OUTROS" ? input.relacaoOutro!.trim() : input.relacao.toLowerCase();
  const observacao = [
    `Relação com o indicador: ${relacao}.`,
    input.observacao?.trim(),
  ].filter(Boolean).join(" ");
  const lead = await upsertLeadPorTelefone(admin, {
    empresa_id: empresaAtiva.id,
    nome,
    whatsapp: telefone,
    origem: "indicacao",
    origem_detalhe: "App do indicador",
    tipo_interesse: input.produto.toLowerCase(),
    tipo_credito: input.produto,
    valor_estimado: input.credito,
    valor_simulado: input.credito,
    status: "Novo",
  });
  if (!lead.ok || !lead.lead_id) return { ok: false, error: lead.error ?? "Não foi possível registrar a indicação." };

  const { data: indicacaoExistente } = await admin
    .from("programa_indicacoes")
    .select("id,indicador_id,status,venda_id")
    .eq("empresa_id", empresaAtiva.id)
    .eq("lead_id", lead.lead_id)
    .maybeSingle();

  if (indicacaoExistente) {
    if (indicacaoExistente.indicador_id !== indicador.id) {
      return {
        ok: false,
        error: "Este telefone já possui uma indicação cadastrada por outro participante.",
        field: "telefone" as const,
      };
    }

    if (!indicacaoExistente.venda_id && indicacaoExistente.status === "PENDENTE") {
      const { error: updateError } = await admin
        .from("programa_indicacoes")
        .update({
          indicador_nome_snapshot: participante.nome,
          indicador_telefone_snapshot: digitsOnlyPhone(participante.whatsapp || participante.telefone || ""),
          produto_interesse: input.produto,
          credito_desejado: input.credito,
          capacidade_mensal: input.capacidadeMensal,
          observacao_indicado: observacao || null,
        })
        .eq("empresa_id", empresaAtiva.id)
        .eq("id", indicacaoExistente.id);
      if (updateError) return { ok: false, error: "Não foi possível atualizar esta indicação agora." };
      revalidatePath("/app-indicador");
      revalidatePath("/app-indicador/indicar");
      return { ok: true };
    }

    return { ok: false, error: "Este telefone já possui uma indicação em andamento." };
  }

  const { error } = await admin.from("programa_indicacoes").insert({
    empresa_id: empresaAtiva.id,
    indicador_id: indicador.id,
    indicador_nome_snapshot: participante.nome,
    indicador_telefone_snapshot: digitsOnlyPhone(participante.whatsapp || participante.telefone || ""),
    lead_id: lead.lead_id,
    produto_interesse: input.produto,
    credito_desejado: input.credito,
    capacidade_mensal: input.capacidadeMensal,
    observacao_indicado: observacao || null,
  });
  if (error) {
    console.error("[app-indicador] falha ao vincular indicação", {
      code: error.code,
      message: error.message,
      empresaId: empresaAtiva.id,
      indicadorId: indicador.id,
      leadId: lead.lead_id,
    });
    return { ok: false, error: "A pessoa foi localizada, mas não foi possível concluir o vínculo da indicação." };
  }

  revalidatePath("/app-indicador");
  revalidatePath("/app-indicador/indicar");
  return { ok: true };
}
