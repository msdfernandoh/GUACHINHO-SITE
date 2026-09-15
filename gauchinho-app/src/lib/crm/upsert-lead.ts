import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Normaliza número de telefone brasileiro para formato canônico:
 * Apenas dígitos, sem DDI 55 (mantém DDD + 8 ou 9 dígitos -> 10 ou 11 dígitos).
 */
export function normalizePhoneForLead(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  // Se começar com 55 e tiver 12 ou 13 dígitos (DDI Brasil + DDD + 8 ou 9 dígitos)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  return digits;
}

/**
 * Valida se o número normalizado corresponde a um telefone válido no Brasil:
 * 10 dígitos (fixo) ou 11 dígitos (celular com 9), com DDD válido (11 a 99).
 */
export function isValidBrazilianPhone(raw: string | null | undefined): boolean {
  const norm = normalizePhoneForLead(raw);
  if (norm.length !== 10 && norm.length !== 11) return false;
  const ddd = parseInt(norm.substring(0, 2), 10);
  return ddd >= 11 && ddd <= 99;
}

export interface UpsertLeadPayload {
  empresa_id?: string | null;
  nome?: string | null;
  whatsapp: string;
  email?: string | null;
  cidade?: string | null;
  origem?: string | null;
  origem_detalhe?: string | null;
  tipo_interesse?: string | null;
  produto_interesse?: string | null;
  tipo_credito?: string | null;
  valor_simulado?: number | null;
  prazo_simulado?: number | null;
  entrada?: number | null;
  renda?: number | null;
  valor_estimado?: number | null;
  dados_simulacao?: Record<string, unknown> | null;
  resultado_resumido?: string | null;
  parceiro_id?: string | null;
  imovel_id?: string | null;
  carta_contemplada_id?: string | null;
  evento_id?: string | null;
  evento_nome?: string | null;
  host_origem?: string | null;
  pagina_origem?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  participante_comercial_id?: string | null;
  status?: string | null;
}

export interface UpsertLeadResult {
  ok: boolean;
  action: "created" | "updated";
  lead_id: string;
  telefone_normalizado: string;
  error?: string;
}

/**
 * Realiza o cadastro ou atualização atômica e idempotente do lead por telefone.
 * Utiliza bloqueio transacional (advisory lock) no PostgreSQL para impedir 100% de duplicações concorrentes.
 * Possui fallback defensivo caso a RPC da migration ainda não esteja ativa no ambiente de execução.
 */
export async function upsertLeadPorTelefone(
  supabaseAdmin: SupabaseClient,
  payload: UpsertLeadPayload
): Promise<UpsertLeadResult> {
  const norm = normalizePhoneForLead(payload.whatsapp);
  if (!norm || norm.length < 10) {
    throw new Error("Telefone inválido para cadastro do lead.");
  }

  // 1. Tentar executar via RPC atômica (com pg_advisory_xact_lock)
  try {
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      "rpc_upsert_lead_por_telefone",
      {
        p_payload: {
          ...payload,
          whatsapp: payload.whatsapp.trim(),
          nome: payload.nome ? payload.nome.trim() : null,
          email: payload.email ? payload.email.trim().toLowerCase() : null,
          cidade: payload.cidade ? payload.cidade.trim() : null,
        },
      }
    );

    if (!rpcError && rpcData && rpcData.ok) {
      return {
        ok: true,
        action: rpcData.action as "created" | "updated",
        lead_id: rpcData.lead_id as string,
        telefone_normalizado: (rpcData.telefone_normalizado as string) || norm,
      };
    }

    // Se a RPC falhar por outro motivo que não ausência da função, loga aviso
    if (rpcError && !rpcError.message.includes("does not exist") && !rpcError.message.includes("function") && rpcError.code !== "42883") {
      console.warn("[upsertLeadPorTelefone] Erro na RPC, acionando fallback:", rpcError);
    }
  } catch (err) {
    console.warn("[upsertLeadPorTelefone] Exceção ao chamar RPC, acionando fallback:", err);
  }

  // 2. Fallback defensivo client-side (compatibilidade e resiliência)
  // Busca se já existe lead pelo telefone normalizado ou pelo whatsapp exato
  const { data: existingLeads } = await supabaseAdmin
    .from("leads")
    .select("id, nome, email, cidade, whatsapp, telefone_normalizado, dados_simulacao, valor_simulado")
    .or(`telefone_normalizado.eq.${norm},whatsapp.ilike.%${norm.slice(-8)}%`)
    .order("created_at", { ascending: true })
    .limit(1);

  const existing = existingLeads && existingLeads.length > 0 ? existingLeads[0] : null;

  if (existing) {
    const updateData: Record<string, unknown> = {
      telefone_normalizado: norm,
      ultima_interacao_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (payload.nome && (!existing.nome || existing.nome.trim() === "" || existing.nome.toLowerCase() === "teste")) {
      updateData.nome = payload.nome.trim();
    }
    if (payload.email && !existing.email) {
      updateData.email = payload.email.trim().toLowerCase();
    }
    if (payload.cidade && !existing.cidade) {
      updateData.cidade = payload.cidade.trim();
    }
    if (payload.valor_simulado != null) {
      updateData.valor_simulado = payload.valor_simulado;
    }
    if (payload.prazo_simulado != null) {
      updateData.prazo_simulado = payload.prazo_simulado;
    }
    if (payload.entrada != null) {
      updateData.entrada = payload.entrada;
    }
    if (payload.dados_simulacao != null) {
      updateData.dados_simulacao = payload.dados_simulacao;
    }
    if (payload.resultado_resumido != null) {
      updateData.resultado_resumido = payload.resultado_resumido;
    }
    if (payload.tipo_interesse != null) {
      updateData.tipo_interesse = payload.tipo_interesse;
    }
    if (payload.produto_interesse != null) {
      updateData.produto_interesse = payload.produto_interesse;
    }
    if (payload.origem_detalhe != null) {
      updateData.origem_detalhe = payload.origem_detalhe;
    }
    if (payload.evento_id != null) {
      updateData.evento_id = payload.evento_id;
    }
    if (payload.evento_nome != null) {
      updateData.evento_nome = payload.evento_nome;
    }

    const { error: updateErr } = await supabaseAdmin
      .from("leads")
      .update(updateData)
      .eq("id", existing.id);

    if (updateErr) {
      throw new Error(`Falha ao atualizar lead existente: ${updateErr.message}`);
    }

    return {
      ok: true,
      action: "updated",
      lead_id: existing.id,
      telefone_normalizado: norm,
    };
  }

  // Não existia: insere novo lead
  const insertData: Record<string, unknown> = {
    nome: payload.nome?.trim() || "Contato sem nome",
    whatsapp: payload.whatsapp.trim(),
    telefone_normalizado: norm,
    email: payload.email?.trim().toLowerCase() || null,
    cidade: payload.cidade?.trim() || null,
    origem: payload.origem || "site",
    origem_detalhe: payload.origem_detalhe || null,
    tipo_interesse: payload.tipo_interesse || null,
    produto_interesse: payload.produto_interesse || null,
    tipo_credito: payload.tipo_credito || null,
    valor_simulado: payload.valor_simulado ?? null,
    prazo_simulado: payload.prazo_simulado ?? null,
    entrada: payload.entrada ?? null,
    renda: payload.renda ?? null,
    valor_estimado: payload.valor_estimado ?? null,
    dados_simulacao: payload.dados_simulacao ?? null,
    resultado_resumido: payload.resultado_resumido ?? null,
    status: payload.status || "Novo",
    empresa_id: payload.empresa_id || null,
    parceiro_id: payload.parceiro_id || null,
    imovel_id: payload.imovel_id || null,
    carta_contemplada_id: payload.carta_contemplada_id || null,
    evento_id: payload.evento_id || null,
    evento_nome: payload.evento_nome || null,
    host_origem: payload.host_origem || null,
    pagina_origem: payload.pagina_origem || null,
    utm_source: payload.utm_source || null,
    utm_medium: payload.utm_medium || null,
    utm_campaign: payload.utm_campaign || null,
    participante_comercial_id: payload.participante_comercial_id || null,
    ultima_interacao_at: new Date().toISOString(),
    criado_manual: false,
  };

  const { data: newLead, error: insertErr } = await supabaseAdmin
    .from("leads")
    .insert(insertData)
    .select("id")
    .single();

  if (insertErr || !newLead) {
    throw new Error(`Falha ao inserir novo lead: ${insertErr?.message || "Sem retorno"}`);
  }

  return {
    ok: true,
    action: "created",
    lead_id: newLead.id,
    telefone_normalizado: norm,
  };
}
