"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { digitsOnlyPhone } from "@/lib/utils/format";
import { upsertLeadPorTelefone } from "@/lib/crm/upsert-lead";

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
  const { data: participante } = await admin
    .from("participantes_comerciais")
    .select("id,nome,telefone,whatsapp")
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", usuario.id)
    .eq("status", "ATIVO")
    .maybeSingle();
  if (!participante) return { ok: false, error: "Seu acesso não está vinculado a um indicador ativo." };

  const { data: indicador } = await admin
    .from("programa_indicadores")
    .select("id")
    .eq("empresa_id", empresaAtiva.id)
    .eq("participante_id", participante.id)
    .eq("ativo", true)
    .maybeSingle();
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
  if (error) return { ok: false, error: "A pessoa foi localizada, mas não foi possível concluir o vínculo da indicação." };

  revalidatePath("/app-indicador");
  revalidatePath("/app-indicador/indicar");
  return { ok: true };
}
