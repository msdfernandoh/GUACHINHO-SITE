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

export type NovaIndicacaoEventoApp = {
  eventoId: string;
  nome: string;
  telefone: string;
  empresa?: string;
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

export async function registrarIndicacaoEventoDoAppAction(input: NovaIndicacaoEventoApp) {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  const nome = input.nome.trim();
  const telefone = digitsOnlyPhone(input.telefone);
  if (!input.eventoId || nome.length < 3 || telefone.length < 10) {
    return { ok: false, error: "Selecione o evento e informe nome e telefone com DDD." };
  }

  const admin = createAdminClient();
  const { participante, indicador } = await resolveIndicadorAppSession(empresaAtiva.id, usuario.id);
  if (!participante || !indicador) return { ok: false, error: "Seu cadastro de indicador não foi localizado." };

  const { data: evento } = await admin
    .from("eventos")
    .select("id,nome,data_evento,ativo")
    .eq("id", input.eventoId)
    .eq("ativo", true)
    .eq("publicado", true)
    .gte("data_evento", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle();
  if (!evento) return { ok: false, error: "Este evento não está mais disponível." };

  const observacao = [
    `Convidado por ${participante.nome} pelo app do indicador para o evento ${evento.nome}.`,
    input.empresa?.trim() ? `Empresa/atividade: ${input.empresa.trim()}.` : "",
    input.observacao?.trim(),
  ].filter(Boolean).join(" ");

  const lead = await upsertLeadPorTelefone(admin, {
    empresa_id: empresaAtiva.id,
    nome,
    whatsapp: telefone,
    origem: "evento",
    origem_detalhe: "Convite pelo app do indicador",
    evento_id: evento.id,
    evento_nome: evento.nome,
    status: "Novo",
    observacoes: observacao,
  });
  if (!lead.ok || !lead.lead_id) return { ok: false, error: lead.error ?? "Não foi possível registrar o contato." };

  const { data: indicacaoExistente } = await admin
    .from("programa_indicacoes")
    .select("id,indicador_id,status,venda_id")
    .eq("empresa_id", empresaAtiva.id)
    .eq("lead_id", lead.lead_id)
    .maybeSingle();
  if (indicacaoExistente?.indicador_id && indicacaoExistente.indicador_id !== indicador.id) {
    return { ok: false, error: "Este telefone já está vinculado a outro indicador." };
  }
  if (!indicacaoExistente) {
    const { error: indicacaoError } = await admin.from("programa_indicacoes").insert({
      empresa_id: empresaAtiva.id,
      indicador_id: indicador.id,
      indicador_nome_snapshot: participante.nome,
      indicador_telefone_snapshot: digitsOnlyPhone(participante.whatsapp || participante.telefone || ""),
      lead_id: lead.lead_id,
      observacao_indicado: observacao,
    });
    if (indicacaoError) return { ok: false, error: "Não foi possível atribuir o convite ao indicador." };
  }

  let { data: lista } = await admin
    .from("eventos_listas_convidados")
    .select("id")
    .eq("evento_id", evento.id)
    .eq("consultor_usuario_id", usuario.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!lista) {
    const { data: novaLista, error: listaError } = await admin
      .from("eventos_listas_convidados")
      .insert({
        evento_id: evento.id,
        consultor_nome: participante.nome,
        consultor_usuario_id: usuario.id,
        criado_por_usuario_id: usuario.id,
      })
      .select("id")
      .single();
    if (listaError || !novaLista) return { ok: false, error: "Não foi possível criar a lista deste evento." };
    lista = novaLista;
  }

  const { data: itemExistente } = await admin
    .from("eventos_listas_convidados_itens")
    .select("id")
    .eq("lista_id", lista.id)
    .eq("telefone", telefone)
    .limit(1)
    .maybeSingle();
  const itemPayload = {
    nome,
    empresa: input.empresa?.trim() || null,
    telefone,
    convidado_por: participante.nome,
    status_presenca: "pendente",
  };
  const itemWrite = itemExistente
    ? await admin.from("eventos_listas_convidados_itens").update(itemPayload).eq("id", itemExistente.id)
    : await admin.from("eventos_listas_convidados_itens").insert({ lista_id: lista.id, ...itemPayload });
  if (itemWrite.error) return { ok: false, error: "Não foi possível incluir o convidado na lista do evento." };

  await admin.from("eventos_listas_convidados").update({ updated_at: new Date().toISOString() }).eq("id", lista.id);
  revalidatePath("/app-indicador");
  revalidatePath("/app-indicador/indicar");
  return { ok: true, eventoNome: evento.nome };
}
