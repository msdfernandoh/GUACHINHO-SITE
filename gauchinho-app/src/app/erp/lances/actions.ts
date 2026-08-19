"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";

export type CotaLanceOperacionalDTO = {
  id: string;
  numeroGrupo: string;
  numeroCota: string | null;
  valorCredito: number;
  prazo: number;
  parcela: number;
  statusCota: string;
  contemplada: boolean;
  cliente: {
    id: string | null;
    nome: string;
    cpfCnpj: string | null;
    telefone: string | null;
    email: string | null;
  };
  administradora: {
    id: string | null;
    nome: string;
  };
  grupo: {
    id: string | null;
    codigoGrupo: string;
    lanceFixoPercentual: number | null;
    segundoLanceFixoPercentual: number | null;
    lanceEmbutidoPermitido: boolean;
    lanceEmbutidoPercentual: number | null;
    lanceFidelidadePermitido: boolean;
    mediaLanceLivre: number | null;
    proximaAssembleiaData: string | null;
    tipoNome: string;
  };
  consultor: {
    id: string | null;
    nome: string;
  };
  estrategia: {
    id: string;
    dataLance: string | null;
    dataVencimento: string | null;
    lanceFixoAtivo: boolean;
    lanceFixoPercentual: number | null;
    lanceFixoValor: number | null;
    segundoLanceFixoAtivo: boolean;
    segundoLanceFixoPercentual: number | null;
    segundoLanceFixoValor: number | null;
    lanceFidelidadeAtivo: boolean;
    lanceFidelidadePercentual: number | null;
    lanceFidelidadeValor: number | null;
    lanceFidelidadeObservacao: string | null;
    lanceLivreAtivo: boolean;
    lanceLivreValor: number | null;
    lanceLivrePercentual: number | null;
    recursoProprioValor: number | null;
    lanceEmbutidoPercentual: number | null;
    lanceEmbutidoValor: number | null;
    parcelaReduzidaAtiva: boolean;
    observacoes: string | null;
    ativa: boolean;
    comprovanteUrl: string | null;
    comprovanteStoragePath: string | null;
    comprovanteNome: string | null;
    confirmado: boolean;
    confirmadoEm: string | null;
    confirmadoPorNome: string | null;
    confirmadoObservacao: string | null;
    revogadoEm: string | null;
    revogadoMotivo: string | null;
  } | null;
  situacaoOperacional:
    | "SEM_ESTRATEGIA"
    | "CONFIRMADO"
    | "VENCENDO"
    | "VENCIDO"
    | "ATIVO"
    | "INATIVO";
  diasParaVencimento: number | null;
  historico: Array<{
    id: string;
    createdAt: string;
    motivo: string | null;
    estadoNovo: Record<string, unknown>;
  }>;
};

export type LancesDashboardStats = {
  totalCotas: number;
  comLanceAtivo: number;
  semEstrategia: number;
  vencendoTrintaDias: number;
  vencidos: number;
  contempladas: number;
};

export async function fetchCotasComLancesOperacional(filters?: {
  busca?: string;
  administradora?: string;
  tipo?: string;
  statusCota?: string;
  situacaoLance?: string;
  consultorId?: string;
}): Promise<{
  stats: LancesDashboardStats;
  rows: CotaLanceOperacionalDTO[];
  empresaId: string;
}> {
  const emptyStats: LancesDashboardStats = {
    totalCotas: 0,
    comLanceAtivo: 0,
    semEstrategia: 0,
    vencendoTrintaDias: 0,
    vencidos: 0,
    contempladas: 0,
  };

  try {
    const { empresaAtiva, usuario } = await getCurrentTenantContext();
    if (!empresaAtiva?.id) {
      return { stats: emptyStats, rows: [], empresaId: "" };
    }

    const supabase = await createClient();

    // 1. Verificar escopo do usuário logado se for participante
    let escopoFiltroParticipanteId: string | null = null;
    if (usuario?.id) {
      try {
        const { data: part } = await supabase
          .from("participantes_comerciais")
          .select("id, escopo_visualizacao")
          .eq("empresa_id", empresaAtiva.id)
          .eq("usuario_id", usuario.id)
          .maybeSingle();

        if (
          part &&
          (part.escopo_visualizacao === "VINCULADOS" ||
            part.escopo_visualizacao === "CRIADOS" ||
            part.escopo_visualizacao === "VINCULADOS_OU_CRIADOS")
        ) {
          escopoFiltroParticipanteId = part.id;
        }
      } catch {
        // Se escopo_visualizacao ainda não existir na tabela, continua normalmente
      }
    }

    // 2. Buscar cotas_definitivas do tenant
    let cotasQuery = supabase
      .from("cotas_definitivas")
      .select("id, empresa_id, numero_grupo, numero_cota, valor_credito, prazo, parcela, status, participante_comercial_id, venda_id, administradora_id, grupo_id, created_at")
      .eq("empresa_id", empresaAtiva.id)
      .order("created_at", { ascending: false });

    if (escopoFiltroParticipanteId) {
      cotasQuery = cotasQuery.eq("participante_comercial_id", escopoFiltroParticipanteId);
    }

    const { data: cotasData, error: cotasError } = await cotasQuery;
    if (cotasError || !cotasData || cotasData.length === 0) {
      return { stats: emptyStats, rows: [], empresaId: empresaAtiva.id };
    }

    const cotaIds = cotasData.map((c) => c.id);
    const vendaIds = Array.from(new Set(cotasData.map((c) => c.venda_id).filter(Boolean)));
    const adminIds = Array.from(new Set(cotasData.map((c) => c.administradora_id).filter(Boolean)));
    const grupoIds = Array.from(new Set(cotasData.map((c) => c.grupo_id).filter(Boolean)));
    const participanteIds = Array.from(new Set(cotasData.map((c) => c.participante_comercial_id).filter(Boolean)));

    // 3. Consultas paralelas auxiliares
    const [
      vendasRes,
      adminsRes,
      gruposRes,
      tiposRes,
      partRes,
      estrategiasRes,
      historicoRes,
    ] = await Promise.all([
      vendaIds.length > 0
        ? supabase.from("vendas").select("id, cliente_nome, cliente_cpf_cnpj, cliente_telefone, cliente_email, participante_comercial_id, cliente_id").in("id", vendaIds)
        : Promise.resolve({ data: [] }),
      adminIds.length > 0
        ? supabase.from("administradoras").select("id, nome").in("id", adminIds)
        : Promise.resolve({ data: [] }),
      grupoIds.length > 0
        ? supabase.from("grupos_consorcio").select("id, codigo_grupo, permite_lance_embutido, percentual_lance_embutido, tipo_administradora_id").in("id", grupoIds)
        : Promise.resolve({ data: [] }),
      supabase.from("administradora_tipos").select("id, nome"),
      participanteIds.length > 0
        ? supabase.from("participantes_comerciais").select("id, nome").in("id", participanteIds)
        : Promise.resolve({ data: [] }),
      cotaIds.length > 0
        ? supabase.from("cota_estrategias_lance").select("*").in("cota_definitiva_id", cotaIds)
        : Promise.resolve({ data: [] }),
      cotaIds.length > 0
        ? supabase.from("cota_estrategias_lance_historico").select("*").in("cota_definitiva_id", cotaIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    // Mapas para lookup O(1)
    const vendasMap = new Map((vendasRes.data ?? []).map((v) => [v.id, v]));
    const adminsMap = new Map((adminsRes.data ?? []).map((a) => [a.id, a]));
    const gruposMap = new Map((gruposRes.data ?? []).map((g) => [g.id, g]));
    const tiposMap = new Map((tiposRes.data ?? []).map((t) => [t.id, t]));
    const partMap = new Map((partRes.data ?? []).map((p) => [p.id, p]));
    const estMap = new Map((estrategiasRes.data ?? []).map((e: any) => [e.cota_definitiva_id, e]));

    // Agrupar histórico por cota
    const histByCota = new Map<string, any[]>();
    for (const h of (historicoRes.data ?? []) as any[]) {
      if (!histByCota.has(h.cota_definitiva_id)) {
        histByCota.set(h.cota_definitiva_id, []);
      }
      histByCota.get(h.cota_definitiva_id)!.push(h);
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let allRows: CotaLanceOperacionalDTO[] = cotasData.map((c) => {
      const venda = c.venda_id ? vendasMap.get(c.venda_id) : null;
      const admin = c.administradora_id ? adminsMap.get(c.administradora_id) : null;
      const grupo = c.grupo_id ? gruposMap.get(c.grupo_id) : null;
      const tipo = grupo?.tipo_administradora_id ? tiposMap.get(grupo.tipo_administradora_id) : null;
      const consultorId = c.participante_comercial_id || venda?.participante_comercial_id;
      const consultor = consultorId ? partMap.get(consultorId) : null;
      const est = estMap.get(c.id);
      const hist = histByCota.get(c.id) ?? [];

      let situacao: CotaLanceOperacionalDTO["situacaoOperacional"] = "SEM_ESTRATEGIA";
      let diasParaVencimento: number | null = null;

      if (est && est.ativa !== false) {
        if (est.confirmado) {
          situacao = "CONFIRMADO";
        } else if (est.data_vencimento) {
          try {
            const [y, m, d] = String(est.data_vencimento).split("-").map(Number);
            const dataVenc = new Date(y, m - 1, d);
            const diffTime = dataVenc.getTime() - hoje.getTime();
            diasParaVencimento = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diasParaVencimento < 0) {
              situacao = "VENCIDO";
            } else if (diasParaVencimento <= 30) {
              situacao = "VENCENDO";
            } else {
              situacao = "ATIVO";
            }
          } catch {
            situacao = "ATIVO";
          }
        } else {
          situacao = "ATIVO";
        }
      } else if (est && est.ativa === false) {
        situacao = "INATIVO";
      }

      return {
        id: c.id,
        numeroGrupo: c.numero_grupo || "—",
        numeroCota: c.numero_cota || null,
        valorCredito: Number(c.valor_credito || 0),
        prazo: Number(c.prazo || 0),
        parcela: Number(c.parcela || 0),
        statusCota: c.status || "ativa",
        contemplada: c.status === "contemplada",
        cliente: {
          id: venda?.cliente_id || null,
          nome: venda?.cliente_nome || "Cliente",
          cpfCnpj: venda?.cliente_cpf_cnpj || null,
          telefone: venda?.cliente_telefone || null,
          email: venda?.cliente_email || null,
        },
        administradora: {
          id: admin?.id || null,
          nome: admin?.nome || "—",
        },
        grupo: {
          id: grupo?.id || null,
          codigoGrupo: grupo?.codigo_grupo || c.numero_grupo || "—",
          lanceFixoPercentual: null,
          segundoLanceFixoPercentual: null,
          lanceEmbutidoPermitido: Boolean(grupo?.permite_lance_embutido),
          lanceEmbutidoPercentual: grupo?.percentual_lance_embutido ? Number(grupo.percentual_lance_embutido) : null,
          lanceFidelidadePermitido: true,
          mediaLanceLivre: null,
          proximaAssembleiaData: null,
          tipoNome: tipo?.nome || "Consórcio",
        },
        consultor: {
          id: consultor?.id || null,
          nome: consultor?.nome || "—",
        },
        estrategia: est
          ? {
              id: est.id,
              dataLance: est.data_lance || null,
              dataVencimento: est.data_vencimento || null,
              lanceFixoAtivo: Boolean(est.lance_fixo_ativo),
              lanceFixoPercentual: est.lance_fixo_percentual ? Number(est.lance_fixo_percentual) : null,
              lanceFixoValor: est.lance_fixo_valor ? Number(est.lance_fixo_valor) : null,
              segundoLanceFixoAtivo: Boolean(est.segundo_lance_fixo_ativo),
              segundoLanceFixoPercentual: est.segundo_lance_fixo_percentual ? Number(est.segundo_lance_fixo_percentual) : null,
              segundoLanceFixoValor: est.segundo_lance_fixo_valor ? Number(est.segundo_lance_fixo_valor) : null,
              lanceFidelidadeAtivo: Boolean(est.lance_fidelidade_ativo),
              lanceFidelidadePercentual: est.lance_fidelidade_percentual ? Number(est.lance_fidelidade_percentual) : null,
              lanceFidelidadeValor: est.lance_fidelidade_valor ? Number(est.lance_fidelidade_valor) : null,
              lanceFidelidadeObservacao: est.lance_fidelidade_observacao || null,
              lanceLivreAtivo: Boolean(est.lance_livre_ativo),
              lanceLivreValor: est.lance_livre_valor ? Number(est.lance_livre_valor) : null,
              lanceLivrePercentual: est.lance_livre_percentual ? Number(est.lance_livre_percentual) : null,
              recursoProprioValor: est.recurso_proprio_valor ? Number(est.recurso_proprio_valor) : null,
              lanceEmbutidoPercentual: est.lance_embutido_percentual ? Number(est.lance_embutido_percentual) : null,
              lanceEmbutidoValor: est.lance_embutido_valor ? Number(est.lance_embutido_valor) : null,
              parcelaReduzidaAtiva: Boolean(est.parcela_reduzida_ativa),
              observacoes: est.observacoes || null,
              ativa: est.ativa !== false,
              comprovanteUrl: est.comprovante_url || null,
              comprovanteStoragePath: est.comprovante_storage_path || null,
              comprovanteNome: est.comprovante_nome || null,
              confirmado: Boolean(est.confirmado),
              confirmadoEm: est.confirmado_em || null,
              confirmadoPorNome: est.confirmado_por_nome || null,
              confirmadoObservacao: est.confirmado_observacao || null,
              revogadoEm: est.revogado_em || null,
              revogadoMotivo: est.revogado_motivo || null,
            }
          : null,
        situacaoOperacional: situacao,
        diasParaVencimento,
        historico: hist.map((h: any) => ({
          id: h.id,
          createdAt: h.created_at,
          motivo: h.motivo,
          estadoNovo: h.estado_novo || {},
        })),
      };
    });

    const stats: LancesDashboardStats = {
      totalCotas: allRows.length,
      comLanceAtivo: allRows.filter((r) => r.estrategia?.ativa && r.situacaoOperacional !== "SEM_ESTRATEGIA").length,
      semEstrategia: allRows.filter((r) => r.situacaoOperacional === "SEM_ESTRATEGIA").length,
      vencendoTrintaDias: allRows.filter((r) => r.situacaoOperacional === "VENCENDO").length,
      vencidos: allRows.filter((r) => r.situacaoOperacional === "VENCIDO").length,
      contempladas: allRows.filter((r) => r.contemplada).length,
    };

    if (filters?.busca?.trim()) {
      const term = filters.busca.trim().toLowerCase();
      allRows = allRows.filter((r) =>
        [
          r.cliente.nome,
          r.cliente.cpfCnpj,
          r.numeroGrupo,
          r.numeroCota,
          r.administradora.nome,
          r.consultor.nome,
        ].some((x) => x?.toLowerCase().includes(term))
      );
    }

    if (filters?.administradora) {
      allRows = allRows.filter((r) => r.administradora.nome === filters.administradora);
    }

    if (filters?.tipo) {
      allRows = allRows.filter((r) => r.grupo.tipoNome === filters.tipo);
    }

    if (filters?.statusCota) {
      allRows = allRows.filter((r) => r.statusCota === filters.statusCota);
    }

    if (filters?.situacaoLance) {
      allRows = allRows.filter((r) => r.situacaoOperacional === filters.situacaoLance);
    }

    if (filters?.consultorId) {
      allRows = allRows.filter((r) => r.consultor.id === filters.consultorId);
    }

    return { stats, rows: allRows, empresaId: empresaAtiva.id };
  } catch {
    return { stats: emptyStats, rows: [], empresaId: "" };
  }
}


export async function salvarEstrategiaLanceCompletaAction(formData: FormData) {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const cotaId = String(formData.get("cota_id") ?? "");
  if (!cotaId) throw new Error("ID da cota obrigatório.");

  const num = (k: string) => {
    const v = formData.get(k);
    if (!v) return null;
    const n = Number(String(v).replace(",", "."));
    return isNaN(n) ? null : n;
  };

  // Datas com regra operacional: se não informada validade, sugere data do lance + 5 meses
  const dataLance = String(formData.get("data_lance") ?? "").trim() || new Date().toISOString().slice(0, 10);
  let dataVencimento = String(formData.get("data_vencimento") ?? "").trim();
  if (!dataVencimento) {
    const [y, m, d] = dataLance.split("-").map(Number);
    const dObj = new Date(y, m - 1 + 5, d);
    dataVencimento = dObj.toISOString().slice(0, 10);
  }

  const lanceFixoAtivo = formData.get("lance_fixo_ativo") === "on";
  const segundoLanceFixoAtivo = formData.get("segundo_lance_fixo_ativo") === "on";
  const lanceFidelidadeAtivo = formData.get("lance_fidelidade_ativo") === "on";
  const lanceLivreAtivo = formData.get("lance_livre_ativo") === "on";
  const parcelaReduzidaAtiva = formData.get("parcela_reduzida_ativa") === "on";

  const lanceFixoPercentual = num("lance_fixo_percentual");
  const lanceFixoValor = num("lance_fixo_valor");
  const segundoLanceFixoPercentual = num("segundo_lance_fixo_percentual");
  const segundoLanceFixoValor = num("segundo_lance_fixo_valor");
  const lanceFidelidadePercentual = num("lance_fidelidade_percentual");
  const lanceFidelidadeValor = num("lance_fidelidade_valor");
  const lanceFidelidadeObservacao = String(formData.get("lance_fidelidade_observacao") ?? "").trim() || null;
  const lanceLivrePercentual = num("lance_livre_percentual");
  const lanceLivreValor = num("lance_livre_valor");
  const recursoProprioValor = num("recurso_proprio_valor");
  const lanceEmbutidoPercentual = num("lance_embutido_percentual");
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;
  const motivo = String(formData.get("motivo") ?? "").trim() || "Atualização de estratégia operacional de lance";
  const consultorResponsavelId = String(formData.get("consultor_responsavel_id") ?? "").trim() || null;

  // Processar Upload de Comprovante se enviado
  const comprovanteFile = formData.get("comprovante_file") as File | null;
  let comprovanteUrl: string | null = null;
  let comprovanteStoragePath: string | null = null;
  let comprovanteNome: string | null = null;

  if (comprovanteFile && comprovanteFile.size > 0) {
    const adminSupabase = createAdminClient();
    const ext = comprovanteFile.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${empresaAtiva.id}/${cotaId}/comprovante_${Date.now()}.${ext}`;

    const { error: uploadErr } = await adminSupabase.storage
      .from("lances-comprovantes")
      .upload(path, comprovanteFile, { contentType: comprovanteFile.type || "application/octet-stream", upsert: true });

    if (!uploadErr) {
      comprovanteStoragePath = path;
      comprovanteNome = comprovanteFile.name;
      const { data: signData } = await adminSupabase.storage
        .from("lances-comprovantes")
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 dias
      comprovanteUrl = signData?.signedUrl || null;
    }
  }

  const supabase = await createClient();

  // Buscar cota para validação de crédito e regras de grupo
  const { data: cota, error: cotaErr } = await supabase
    .from("cotas_definitivas")
    .select("valor_credito, grupo_id")
    .eq("id", cotaId)
    .eq("empresa_id", empresaAtiva.id)
    .single();
  if (cotaErr || !cota) throw new Error("Cota não encontrada.");

  const valorCredito = Number(cota.valor_credito);
  const lanceEmbutidoValorCalculado =
    lanceEmbutidoPercentual && valorCredito > 0 ? Number(((valorCredito * lanceEmbutidoPercentual) / 100).toFixed(2)) : null;

  const dadosUpsert: Record<string, unknown> = {
    empresa_id: empresaAtiva.id,
    cota_definitiva_id: cotaId,
    data_lance: dataLance,
    data_vencimento: dataVencimento,
    lance_fixo_ativo: lanceFixoAtivo,
    lance_fixo_percentual: lanceFixoPercentual,
    lance_fixo_valor: lanceFixoValor,
    segundo_lance_fixo_ativo: segundoLanceFixoAtivo,
    segundo_lance_fixo_percentual: segundoLanceFixoPercentual,
    segundo_lance_fixo_valor: segundoLanceFixoValor,
    lance_fidelidade_ativo: lanceFidelidadeAtivo,
    lance_fidelidade_percentual: lanceFidelidadePercentual,
    lance_fidelidade_valor: lanceFidelidadeValor,
    lance_fidelidade_observacao: lanceFidelidadeObservacao,
    lance_livre_ativo: lanceLivreAtivo,
    lance_livre_percentual: lanceLivrePercentual,
    lance_livre_valor: lanceLivreValor,
    recurso_proprio_valor: recursoProprioValor,
    lance_embutido_percentual: lanceEmbutidoPercentual,
    lance_embutido_valor: lanceEmbutidoValorCalculado,
    parcela_reduzida_ativa: parcelaReduzidaAtiva,
    observacoes,
    ativa: true,
    consultor_responsavel_id: consultorResponsavelId,
    updated_at: new Date().toISOString(),
  };

  if (comprovanteStoragePath) {
    dadosUpsert.comprovante_storage_path = comprovanteStoragePath;
    dadosUpsert.comprovante_url = comprovanteUrl;
    dadosUpsert.comprovante_nome = comprovanteNome;
  }

  // Buscar estado anterior para histórico
  const { data: estadoAnterior } = await supabase
    .from("cota_estrategias_lance")
    .select("*")
    .eq("cota_definitiva_id", cotaId)
    .maybeSingle();

  const { data: saved, error: saveErr } = await supabase
    .from("cota_estrategias_lance")
    .upsert(dadosUpsert, { onConflict: "cota_definitiva_id" })
    .select("id")
    .single();

  if (saveErr) throw new Error(saveErr.message);

  // Inserir histórico
  await supabase.from("cota_estrategias_lance_historico").insert({
    empresa_id: empresaAtiva.id,
    estrategia_id: saved.id,
    cota_definitiva_id: cotaId,
    estado_anterior: estadoAnterior ? (estadoAnterior as any) : null,
    estado_novo: dadosUpsert,
    motivo,
    usuario_id: usuario?.id || null,
  });

  revalidatePath("/erp/lances");
  revalidatePath("/erp");
}

export async function confirmarLanceOperacionalAction(cotaId: string, observacao?: string) {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_confirmar_lance_cota", {
    p_empresa_id: empresaAtiva.id,
    p_cota_id: cotaId,
    p_observacao: observacao || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/erp/lances");
  revalidatePath("/erp");
}

export async function revogarConfirmacaoLanceOperacionalAction(cotaId: string, motivo: string) {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_revogar_confirmacao_lance_cota", {
    p_empresa_id: empresaAtiva.id,
    p_cota_id: cotaId,
    p_motivo: motivo,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/erp/lances");
  revalidatePath("/erp");
}

export type BidState = { ok: boolean; message: string };

export async function salvarEstrategiaLanceAction(
  _previous: BidState,
  formData: FormData
): Promise<BidState> {
  try {
    await salvarEstrategiaLanceCompletaAction(formData);
    return { ok: true, message: "Estratégia salva; histórico preservado." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao salvar estratégia.",
    };
  }
}

