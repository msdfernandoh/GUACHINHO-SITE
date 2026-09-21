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
  valor_credito?: number | null;
  valor_parcela?: number | null;
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
  etapa_id?: string | null;
  capacidade_mensal?: string | null;
  observacoes?: string | null;
  historico_cadastros?: string | null;
  srd_responsavel_id?: string | null;
  srd_responsavel_nome?: string | null;
  temperatura?: string | null;
  modelo_interesse?: string | null;
  proxima_acao?: string | null;
  permitir_gerar_novo?: boolean | null;
  forcar_novo?: boolean | null;
}

/**
 * Formata um bloco cronológico com data e hora operacional (America/Cuiaba)
 * detalhando as novas informações trazidas por um cadastro ou abordagem.
 */
export function formatarEntradaHistoricoLead(
  payload: UpsertLeadPayload,
  options?: { dataHora?: Date }
): string {
  const dt = options?.dataHora ?? new Date();
  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);

  const origemTxt = payload.evento_nome || payload.origem_detalhe || payload.origem || "Novo contato";
  const tipoInv = payload.produto_interesse || payload.tipo_interesse || payload.tipo_credito;
  const credito =
    payload.valor_credito ??
    payload.valor_estimado ??
    (payload.valor_simulado && payload.valor_simulado > 5000 ? payload.valor_simulado : null);
  const parcela = payload.valor_parcela;

  const linhas: string[] = [
    `[${dataFormatada}] Nova abordagem / cadastro (${origemTxt}):`,
  ];

  if (payload.evento_nome) {
    linhas.push(`• Evento: ${payload.evento_nome}`);
  }
  if (tipoInv) {
    linhas.push(`• Tipo de investimento / interesse: ${tipoInv}`);
  }
  if (credito != null && Number.isFinite(Number(credito)) && Number(credito) > 0) {
    linhas.push(
      `• Crédito pretendido: ${new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(credito))}`
    );
  }
  if (parcela != null && Number.isFinite(Number(parcela)) && Number(parcela) > 0) {
    linhas.push(
      `• Parcela mensal pretendida: ${new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(parcela))}/mês`
    );
  } else if (payload.capacidade_mensal) {
    linhas.push(`• Capacidade mensal de parcela: ${payload.capacidade_mensal}`);
  }
  if (payload.prazo_simulado != null && payload.prazo_simulado > 0) {
    linhas.push(`• Prazo pretendido: ${payload.prazo_simulado} meses`);
  }
  if (payload.cidade) {
    linhas.push(`• Cidade: ${payload.cidade}`);
  }
  if (payload.observacoes?.trim()) {
    linhas.push(`• Observações: ${payload.observacoes.trim()}`);
  }

  return linhas.join("\n");
}

export interface UpsertLeadResult {
  ok: boolean;
  action: "created" | "updated" | "copied_new_deal";
  lead_id: string;
  telefone_normalizado: string;
  lead_origem_ganho_id?: string | null;
  error?: string;
}

export function isLeadGanho(status?: string | null, isWon?: boolean | null): boolean {
  if (isWon) return true;
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === "fechado" || s === "ganho" || s === "venda fechada" || s === "venda_fechada";
}

/**
 * Realiza o cadastro ou atualização atômica e idempotente do lead por telefone.
 * Utiliza bloqueio transacional (advisory lock) no PostgreSQL para impedir 100% de duplicações concorrentes.
 * Se o lead anterior estiver no funil de ganho (venda fechada), cria automaticamente uma cópia
 * como NOVA NEGOCIAÇÃO no funil inicial, preservando o histórico consolidado.
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
        action: rpcData.action as "created" | "updated" | "copied_new_deal",
        lead_id: rpcData.lead_id as string,
        telefone_normalizado: (rpcData.telefone_normalizado as string) || norm,
        lead_origem_ganho_id: (rpcData.lead_origem_ganho_id as string) || null,
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
  const forcarNovo = Boolean(payload.permitir_gerar_novo || payload.forcar_novo);

  // Busca se já existem leads pelo telefone normalizado ou pelo whatsapp
  const { data: existingLeads } = await supabaseAdmin
    .from("leads")
    .select("id, nome, email, cidade, whatsapp, telefone_normalizado, dados_simulacao, valor_simulado, valor_estimado, historico_cadastros, observacoes, status, etapa_id, srd_responsavel_id, srd_responsavel_nome, modelo_interesse, empresa_id, tipo_interesse, produto_interesse, tipo_credito, carta_contemplada_id, imovel_id, parceiro_id")
    .or(`telefone_normalizado.eq.${norm},whatsapp.ilike.%${norm.slice(-8)}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  const newEntry = formatarEntradaHistoricoLead(payload);

  const activeLead = !forcarNovo
    ? (existingLeads ?? []).find((l) => !isLeadGanho(l.status))
    : null;

  const wonLead = (existingLeads ?? []).find((l) => isLeadGanho(l.status));

  // CASO 1: Lead em andamento ativo encontrado -> Atualiza, move para 'Novo lead' e acumula histórico
  if (activeLead) {
    let targetEtapaId = payload.etapa_id;
    if (!targetEtapaId) {
      const empId = payload.empresa_id || activeLead.empresa_id;
      if (empId) {
        const { data: etapaNovo } = await supabaseAdmin
          .from("crm_funil_etapas")
          .select("id")
          .eq("empresa_id", empId)
          .eq("slug", "novo_lead")
          .maybeSingle();
        if (etapaNovo?.id) {
          targetEtapaId = etapaNovo.id;
        }
      }
    }

    const updateData: Record<string, unknown> = {
      telefone_normalizado: norm,
      status: "Novo",
      etapa_id: targetEtapaId || activeLead.etapa_id,
      fechado: false,
      perdido_at: null,
      ultima_interacao_at: new Date().toISOString(),
      data_ultimo_contato: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Acúmulo de histórico com data na frente
    const existingHist = activeLead.historico_cadastros ? String(activeLead.historico_cadastros).trim() : "";
    updateData.historico_cadastros = existingHist ? `${newEntry}\n\n---\n\n${existingHist}` : newEntry;

    // Mantém no campo observações a última observação informada (ou a nova entrada se não houver texto avulso)
    updateData.observacoes = payload.observacoes?.trim() || newEntry;

    if (payload.nome && (!activeLead.nome || activeLead.nome.trim() === "" || activeLead.nome.toLowerCase() === "teste")) {
      updateData.nome = payload.nome.trim();
    }
    if (payload.email && !activeLead.email) {
      updateData.email = payload.email.trim().toLowerCase();
    }
    if (payload.cidade && !activeLead.cidade) {
      updateData.cidade = payload.cidade.trim();
    }
    if (payload.valor_credito != null) {
      updateData.valor_credito = payload.valor_credito;
      updateData.valor_estimado = payload.valor_credito;
    } else if (payload.valor_estimado != null) {
      updateData.valor_estimado = payload.valor_estimado;
      updateData.valor_credito = payload.valor_estimado;
    }
    if (payload.valor_simulado != null) {
      updateData.valor_simulado = payload.valor_simulado;
    }
    if (payload.valor_parcela != null) {
      updateData.valor_parcela = payload.valor_parcela;
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
    if (payload.etapa_id != null) {
      updateData.etapa_id = payload.etapa_id;
    }
    if (payload.srd_responsavel_id != null) {
      updateData.srd_responsavel_id = payload.srd_responsavel_id;
    }
    if (payload.srd_responsavel_nome != null) {
      updateData.srd_responsavel_nome = payload.srd_responsavel_nome;
    }
    if (payload.temperatura != null) {
      updateData.temperatura = payload.temperatura;
    }
    if (payload.modelo_interesse != null) {
      updateData.modelo_interesse = payload.modelo_interesse;
    }
    if (payload.proxima_acao != null) {
      updateData.proxima_acao = payload.proxima_acao;
    }

    const { error: updateErr } = await supabaseAdmin
      .from("leads")
      .update(updateData)
      .eq("id", activeLead.id);

    if (updateErr) {
      throw new Error(`Falha ao atualizar lead existente: ${updateErr.message}`);
    }

    return {
      ok: true,
      action: "updated",
      lead_id: activeLead.id,
      telefone_normalizado: norm,
    };
  }

  // CASO 2: Nenhum lead ativo. Existe lead Ganho / Fechado -> GERA NOVA NEGOCIAÇÃO (CÓPIA)
  if (wonLead) {
    const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Cuiaba",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    const entryGanho = `[${dataFormatada}] 🌟 NOVA NEGOCIAÇÃO (Cliente com venda anterior ganha - Ref #${wonLead.id.slice(0, 8)}):\n${newEntry}`;

    const histConsolidado = wonLead.historico_cadastros
      ? `${entryGanho}\n\n---\n[Histórico Consolidado da Negociação Anterior]:\n${wonLead.historico_cadastros}`
      : wonLead.observacoes
      ? `${entryGanho}\n\n---\n[Histórico Consolidado da Negociação Anterior]:\n${wonLead.observacoes}`
      : entryGanho;

    let wonTargetEtapaId = payload.etapa_id;
    if (!wonTargetEtapaId) {
      const empId = payload.empresa_id || wonLead.empresa_id;
      if (empId) {
        const { data: etapaNovo } = await supabaseAdmin
          .from("crm_funil_etapas")
          .select("id")
          .eq("empresa_id", empId)
          .eq("slug", "novo_lead")
          .maybeSingle();
        if (etapaNovo?.id) {
          wonTargetEtapaId = etapaNovo.id;
        }
      }
    }

    const insertData: Record<string, unknown> = {
      empresa_id: payload.empresa_id || wonLead.empresa_id || null,
      nome: payload.nome?.trim() || wonLead.nome || "Contato sem nome",
      whatsapp: payload.whatsapp.trim(),
      telefone_normalizado: norm,
      email: payload.email?.trim().toLowerCase() || wonLead.email || null,
      cidade: payload.cidade?.trim() || wonLead.cidade || null,
      origem: payload.origem || "recorrente",
      origem_detalhe: payload.origem_detalhe || "Nova negociação de cliente ganho",
      tipo_interesse: payload.tipo_interesse || wonLead.tipo_interesse || null,
      produto_interesse: payload.produto_interesse || wonLead.produto_interesse || null,
      tipo_credito: payload.tipo_credito || wonLead.tipo_credito || null,
      valor_simulado: payload.valor_simulado ?? null,
      prazo_simulado: payload.prazo_simulado ?? null,
      entrada: payload.entrada ?? null,
      renda: payload.renda ?? null,
      valor_credito: payload.valor_credito ?? payload.valor_estimado ?? null,
      valor_estimado: payload.valor_credito ?? payload.valor_estimado ?? payload.valor_simulado ?? wonLead.valor_estimado ?? null,
      valor_parcela: payload.valor_parcela ?? null,
      dados_simulacao: payload.dados_simulacao ?? null,
      resultado_resumido: payload.resultado_resumido ?? null,
      status: "Novo",
      etapa_id: wonTargetEtapaId || null,
      srd_responsavel_id: wonLead.srd_responsavel_id || null,
      srd_responsavel_nome: wonLead.srd_responsavel_nome || null,
      temperatura: "Quente",
      modelo_interesse: payload.modelo_interesse || wonLead.modelo_interesse || "CLIENTE_FINAL",
      proxima_acao: payload.proxima_acao || "Fazer contato - Cliente recorrente",
      historico_cadastros: histConsolidado,
      observacoes: payload.observacoes?.trim() || entryGanho,
      ultima_interacao_at: new Date().toISOString(),
      data_ultimo_contato: new Date().toISOString(),
      criado_manual: false,
    };

    const { data: newLead, error: insertErr } = await supabaseAdmin
      .from("leads")
      .insert(insertData)
      .select("id")
      .single();

    if (insertErr || !newLead) {
      throw new Error(`Falha ao gerar nova negociação para cliente ganho: ${insertErr?.message}`);
    }

    return {
      ok: true,
      action: "copied_new_deal",
      lead_id: newLead.id,
      telefone_normalizado: norm,
      lead_origem_ganho_id: wonLead.id,
    };
  }

  // CASO 3: Não existia nenhum lead prévio -> Insere novo lead normal
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
    valor_credito: payload.valor_credito ?? payload.valor_estimado ?? null,
    valor_estimado: payload.valor_credito ?? payload.valor_estimado ?? null,
    valor_simulado: payload.valor_simulado ?? null,
    valor_parcela: payload.valor_parcela ?? null,
    prazo_simulado: payload.prazo_simulado ?? null,
    entrada: payload.entrada ?? null,
    renda: payload.renda ?? null,
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
    historico_cadastros: newEntry,
    observacoes: payload.observacoes?.trim() || newEntry,
    etapa_id: payload.etapa_id || null,
    srd_responsavel_id: payload.srd_responsavel_id || null,
    srd_responsavel_nome: payload.srd_responsavel_nome || null,
    temperatura: payload.temperatura || null,
    modelo_interesse: payload.modelo_interesse || null,
    proxima_acao: payload.proxima_acao || null,
    ultima_interacao_at: new Date().toISOString(),
    data_ultimo_contato: new Date().toISOString(),
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
