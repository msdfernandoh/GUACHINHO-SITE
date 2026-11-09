"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";

export type CotaLanceOperacionalDTO = {
  id: string;
  numeroGrupo: string;
  numeroCota: string | null;
  valorCredito: number;
  saldoDevedor: number;
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
    lanceLivreMaximoPercentual: number | null;
    proximaAssembleiaData: string | null;
    tipoNome: string;
    modalidades: Array<{
      tipo: "LIVRE" | "FIXO" | "SEGUNDO_FIXO" | "FIDELIDADE";
      percentual: number | null;
      embutidoMaximo: number;
      nome: string;
    }>;
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
    lanceLivreEmbutidoPercentual: number | null;
    lanceFixoEmbutidoPercentual: number | null;
    segundoLanceFixoEmbutidoPercentual: number | null;
    lanceEmbutidoValor: number | null;
    parcelaReduzidaAtiva: boolean;
    observacoes: string | null;
    ativa: boolean;
    comprovanteUrl: string | null;
    comprovanteStoragePath: string | null;
    comprovanteNome: string | null;
    comprovantes: Array<{
      id: string;
      tipoLance: string;
      protocolo: string | null;
      comprovanteUrl: string | null;
      comprovanteStoragePath: string | null;
      ofertadoEm: string | null;
      status: string;
    }>;
    confirmado: boolean;
    confirmadoEm: string | null;
    confirmadoPorNome: string | null;
    confirmadoObservacao: string | null;
    revogadoEm: string | null;
    revogadoMotivo: string | null;
    protocoloLanceLivre: string | null;
    protocoloLanceFixo: string | null;
    protocoloSegundoLanceFixo: string | null;
    assembleiaNumero: string | null;
    assembleiaData: string | null;
    repetirSeisAssembleias: boolean;
    ultimoLanceOfertadoEm: string | null;
    ofertaOrigem: string | null;
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

function valorCreditoPorCota(cota: { valor_credito?: unknown; snapshot_cota?: unknown }): number {
  const valorRegistrado = Number(cota.valor_credito || 0);
  const snapshot = cota.snapshot_cota && typeof cota.snapshot_cota === "object"
    ? (cota.snapshot_cota as Record<string, unknown>)
    : null;
  const valorRacon = Number(snapshot?.valor_bem_racon);
  if (snapshot?.fonte_dados_racon === "NEWCON" && Number.isFinite(valorRacon) && valorRacon > 0) {
    return valorRacon;
  }
  const quantidadeCotas = Number(snapshot?.quantidade_cotas || 1);
  const valorTotalVenda = Number(snapshot?.valor_credito_total_venda || 0);

  // Alguns legados gravaram o total da venda em cada linha de cota. Só divide
  // quando o snapshot comprova que o valor repetido é o total contratado.
  if (quantidadeCotas > 1 && valorTotalVenda > 0 && Math.abs(valorRegistrado - valorTotalVenda) < 0.01) {
    return Number((valorTotalVenda / quantidadeCotas).toFixed(2));
  }

  if (Number.isFinite(valorRegistrado) && valorRegistrado > 0) return valorRegistrado;

  // Na importação legada este campo foi gravado individualmente por cota.
  const valorLegado = Number(snapshot?.valor_credito_contratado);
  return snapshot?.origem === "IMPORTACAO_LEGADO" && Number.isFinite(valorLegado) && valorLegado > 0 ? valorLegado : 0;
}

function saldoDevedorPorCota(cota: { snapshot_cota?: unknown }, saldoOpcao?: unknown): number {
  const snapshot = cota.snapshot_cota && typeof cota.snapshot_cota === "object"
    ? (cota.snapshot_cota as Record<string, unknown>)
    : null;
  // O saldo retornado pela Racon/Newcon e persistido no snapshot da cota é a
  // fonte de verdade para o lance. A opção do catálogo é apenas um fallback;
  // ela não representa o saldo individual atualizado do consorciado.
  return Number(snapshot?.saldo_devedor ?? saldoOpcao ?? 0);
}

function maxLanceLivreUltimaAssembleia(resultados: Array<{ assembleia_numero?: number | null; cotas?: unknown }> | null | undefined): number | null {
  const linhas = (resultados ?? []).filter((resultado) => Array.isArray(resultado.cotas));
  if (!linhas.length) return null;
  const maiorAssembleia = Math.max(...linhas.map((resultado) => Number(resultado.assembleia_numero || 0)));
  const valores = linhas
    .filter((resultado) => Number(resultado.assembleia_numero || 0) === maiorAssembleia)
    .flatMap((resultado) => (resultado.cotas as unknown[]))
    .filter((cota): cota is Record<string, unknown> => Boolean(cota && typeof cota === "object"))
    .filter((cota) => String(cota.modalidade ?? "").toUpperCase().includes("LIVRE"))
    .filter((cota) => !cota.situacao_cota || ["ATIVA", "CONFIRMADA"].includes(String(cota.situacao_cota).toUpperCase()))
    .map((cota) => Number(cota.percentual_lance))
    .filter((valor) => Number.isFinite(valor) && valor > 0);
  if (!valores.length) return null;
  const primeiro = valores[0];
  // Só é um máximo fixo quando a última assembleia inteira praticou o mesmo
  // percentual. Havendo dispersão, não inventamos um teto para a próxima oferta.
  return valores.every((valor) => Math.abs(valor - primeiro) <= 0.0001) ? primeiro : null;
}

function inferirModalidadeLance(nome: unknown): "LIVRE" | "FIXO" | "SEGUNDO_FIXO" | "FIDELIDADE" {
  const texto = String(nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (texto.includes("LIVRE")) return "LIVRE";
  if (texto.includes("FIDELIDADE")) return "FIDELIDADE";
  // Não usar apenas includes("2"): nomes como "LANCE FIXO 25%" contêm o
  // dígito 2, mas continuam sendo Lance Fixo, não 2º Lance Fixo.
  if (texto.includes("SEGUNDO") || /(?:^|\s)2(?:º|°|O)?(?:\s|$)/.test(texto)) return "SEGUNDO_FIXO";
  return "FIXO";
}

function percentualNoNome(nome: unknown): number | null {
  const match = String(nome ?? "").replace(",", ".").match(/(?:^|\s)(\d+(?:\.\d+)?)\s*%?/);
  return match ? Number(match[1]) : null;
}

function classificarModalidades(modalidades: Array<{ nome?: string | null; percentual?: number | null }>) {
  const classificadas = modalidades.map((modalidade) => ({
    ...modalidade,
    tipo: inferirModalidadeLance(modalidade.nome),
    percentual: modalidade.percentual ?? percentualNoNome(modalidade.nome),
  }));

  // O cadastro legado registra as alternativas de embutido, não o rótulo
  // "fixo/2º fixo". Quando há duas alternativas sem tipo explícito, a maior
  // percentual é o Lance Fixo e a menor é o 2º Lance Fixo.
  if (classificadas.length > 1 && classificadas.every((modalidade) => modalidade.tipo === "FIXO")) {
    const ordenadas = [...classificadas].sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0));
    ordenadas.forEach((modalidade, index) => {
      modalidade.tipo = index === 0 ? "FIXO" : "SEGUNDO_FIXO";
    });
    return classificadas.map((modalidade) => ordenadas.find((item) => item === modalidade) ?? modalidade);
  }

  return classificadas;
}

function modalidadeHabilitada(modalidades: Array<{ nome?: string | null }> | null | undefined, tipo: "LIVRE" | "FIXO" | "SEGUNDO_FIXO" | "FIDELIDADE") {
  const normalizadas = classificarModalidades(modalidades ?? []).map((modalidade) => modalidade.tipo);
  // Lance Livre é padrão operacional de todos os grupos; o cadastro
  // personalizado controla apenas as modalidades adicionais.
  return tipo === "LIVRE" || normalizadas.length === 0 || normalizadas.includes(tipo);
}

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
  const { empresaAtiva, usuario } = await requireErpRouteAccess("lances");
  const emptyStats: LancesDashboardStats = {
    totalCotas: 0,
    comLanceAtivo: 0,
    semEstrategia: 0,
    vencendoTrintaDias: 0,
    vencidos: 0,
    contempladas: 0,
  };

  try {
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
      .select("id, empresa_id, numero_grupo, numero_cota, valor_credito, snapshot_cota, prazo, parcela, status, participante_comercial_id, venda_id, administradora_id, grupo_id, created_at")
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
    const opcaoCotaIds = Array.from(new Set(cotasData.map((c) => {
      const snapshot = c.snapshot_cota && typeof c.snapshot_cota === "object" ? (c.snapshot_cota as Record<string, unknown>) : null;
      return typeof snapshot?.opcao_cota_id === "string" ? snapshot.opcao_cota_id : null;
    }).filter(Boolean)));
    const participanteIds = Array.from(new Set(cotasData.map((c) => c.participante_comercial_id).filter(Boolean)));

    // 3. Consultas paralelas auxiliares
    const [
      vendasRes,
      adminsRes,
      gruposRes,
      cotasOpcoesRes,
      modalidadesRes,
      resultadosRes,
      tiposRes,
      partRes,
      estrategiasRes,
      historicoRes,
      ofertasRes,
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
      opcaoCotaIds.length > 0
        ? supabase.from("grupos_cotas").select("id, saldo_devedor").in("id", opcaoCotaIds)
        : Promise.resolve({ data: [] }),
      grupoIds.length > 0
        ? supabase.from("grupos_modalidades_lance").select("id, grupo_id, nome, percentual_lance_embutido, ativo, ordem").in("grupo_id", grupoIds).eq("ativo", true).order("ordem", { ascending: true })
        : Promise.resolve({ data: [] }),
      grupoIds.length > 0
        ? supabase.from("grupo_assembleias_resultados").select("grupo_id, assembleia_numero, cotas").in("grupo_id", grupoIds).order("assembleia_numero", { ascending: false })
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
      cotaIds.length > 0
        ? supabase.from("cota_lances_ofertados").select("id, cota_definitiva_id, tipo_lance, protocolo, comprovante_storage_path, comprovante_url, ofertado_em, status").in("cota_definitiva_id", cotaIds).order("ofertado_em", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    // Mapas para lookup O(1)
    const vendasMap = new Map((vendasRes.data ?? []).map((v) => [v.id, v]));
    const adminsMap = new Map((adminsRes.data ?? []).map((a) => [a.id, a]));
    const gruposMap = new Map((gruposRes.data ?? []).map((g) => [g.id, g]));
    const opcoesCotasMap = new Map((cotasOpcoesRes.data ?? []).map((opcao) => [opcao.id, opcao]));
    const modalidadesByGrupo = new Map<string, any[]>();
    for (const modalidade of (modalidadesRes.data ?? []) as any[]) {
      const lista = modalidadesByGrupo.get(modalidade.grupo_id) ?? [];
      lista.push(modalidade);
      modalidadesByGrupo.set(modalidade.grupo_id, lista);
    }
    const resultadosByGrupo = new Map<string, any[]>();
    for (const resultado of (resultadosRes.data ?? []) as any[]) {
      const lista = resultadosByGrupo.get(resultado.grupo_id) ?? [];
      lista.push(resultado);
      resultadosByGrupo.set(resultado.grupo_id, lista);
    }
    const tiposMap = new Map((tiposRes.data ?? []).map((t) => [t.id, t]));
    const partMap = new Map((partRes.data ?? []).map((p) => [p.id, p]));
    const estMap = new Map((estrategiasRes.data ?? []).map((e) => [e.cota_definitiva_id, e]));
    const ofertasByCota = new Map<string, any[]>();
    for (const oferta of (ofertasRes.data ?? []) as any[]) {
      const lista = ofertasByCota.get(oferta.cota_definitiva_id) ?? [];
      lista.push(oferta);
      ofertasByCota.set(oferta.cota_definitiva_id, lista);
    }

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
      const snapshot = c.snapshot_cota && typeof c.snapshot_cota === "object" ? (c.snapshot_cota as Record<string, unknown>) : null;
      const opcaoCota = typeof snapshot?.opcao_cota_id === "string" ? opcoesCotasMap.get(snapshot.opcao_cota_id) : null;
      // A estratégia pode estar habilitada para o robô antes de qualquer oferta.
      // Datas e validade só representam um lance efetivamente enviado quando
      // existe protocolo, horário de oferta ou confirmação auditável.
      const lanceEfetivado = Boolean(
        est?.ultimo_lance_ofertado_em ||
          est?.protocolo_lance_livre ||
          est?.protocolo_lance_fixo ||
          est?.protocolo_segundo_lance_fixo ||
          est?.confirmado,
      );
      const modalidades = classificarModalidades(modalidadesByGrupo.get(c.grupo_id) ?? []).map((m) => ({
        tipo: m.tipo,
        percentual: m.percentual,
        embutidoMaximo: Math.round(Number((m as any).percentual_lance_embutido || grupo?.percentual_lance_embutido || 0)),
        nome: String(m.nome || "Modalidade"),
      }));
      const primeiroFixo = modalidades.find((m) => m.tipo === "FIXO");
      const segundoFixo = modalidades.find((m) => m.tipo === "SEGUNDO_FIXO");
      const hist = histByCota.get(c.id) ?? [];

      let situacao: CotaLanceOperacionalDTO["situacaoOperacional"] = "SEM_ESTRATEGIA";
      let diasParaVencimento: number | null = null;

      if (est && est.ativa !== false) {
        if (lanceEfetivado && est.data_vencimento) {
          try {
            const [y, m, d] = String(est.data_vencimento).split("-").map(Number);
            const dataVenc = new Date(y, m - 1, d);
            const diffTime = dataVenc.getTime() - hoje.getTime();
            diasParaVencimento = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          } catch {
            diasParaVencimento = null;
          }
        }

        if (est.confirmado) {
          situacao = "CONFIRMADO";
        } else if (diasParaVencimento !== null) {
          if (diasParaVencimento < 0) {
            situacao = "VENCIDO";
          } else if (diasParaVencimento <= 30) {
            situacao = "VENCENDO";
          } else {
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
        valorCredito: valorCreditoPorCota(c),
        saldoDevedor: saldoDevedorPorCota(c, opcaoCota?.saldo_devedor),
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
          lanceFixoPercentual: primeiroFixo?.percentual ?? null,
          segundoLanceFixoPercentual: segundoFixo?.percentual ?? null,
          lanceEmbutidoPermitido: Boolean(grupo?.permite_lance_embutido),
          lanceEmbutidoPercentual: grupo?.percentual_lance_embutido ? Math.round(Number(grupo.percentual_lance_embutido)) : null,
          lanceFidelidadePermitido: modalidades.some((m) => m.tipo === "FIDELIDADE"),
          mediaLanceLivre: null,
          lanceLivreMaximoPercentual: maxLanceLivreUltimaAssembleia(resultadosByGrupo.get(c.grupo_id)),
          proximaAssembleiaData: null,
          tipoNome: tipo?.nome || "Consórcio",
          modalidades,
        },
        consultor: {
          id: consultor?.id || null,
          nome: consultor?.nome || "—",
        },
        estrategia: est
          ? {
              id: est.id,
              dataLance: lanceEfetivado ? est.data_lance || null : null,
              dataVencimento: lanceEfetivado ? est.data_vencimento || null : null,
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
              lanceEmbutidoPercentual: est.lance_embutido_percentual ? Math.round(Number(est.lance_embutido_percentual)) : null,
              lanceLivreEmbutidoPercentual: est.lance_livre_embutido_percentual == null ? null : Number(est.lance_livre_embutido_percentual),
              lanceFixoEmbutidoPercentual: est.lance_fixo_embutido_percentual == null ? null : Number(est.lance_fixo_embutido_percentual),
              segundoLanceFixoEmbutidoPercentual: est.segundo_lance_fixo_embutido_percentual == null ? null : Number(est.segundo_lance_fixo_embutido_percentual),
              lanceEmbutidoValor: est.lance_embutido_valor ? Number(est.lance_embutido_valor) : null,
              parcelaReduzidaAtiva: Boolean(est.parcela_reduzida_ativa),
              observacoes: est.observacoes || null,
              ativa: est.ativa !== false,
              comprovanteUrl: est.comprovante_url || null,
              comprovanteStoragePath: est.comprovante_storage_path || null,
              comprovanteNome: est.comprovante_nome || null,
              comprovantes: (ofertasByCota.get(c.id) ?? []).map((oferta) => ({
                id: oferta.id,
                tipoLance: oferta.tipo_lance,
                protocolo: oferta.protocolo || null,
                comprovanteUrl: oferta.comprovante_url || null,
                comprovanteStoragePath: oferta.comprovante_storage_path || null,
                ofertadoEm: oferta.ofertado_em || null,
                status: oferta.status || "CONFIRMADO",
              })),
              confirmado: Boolean(est.confirmado),
              confirmadoEm: est.confirmado_em || null,
              confirmadoPorNome: est.confirmado_por_nome || null,
              confirmadoObservacao: est.confirmado_observacao || null,
              revogadoEm: est.revogado_em || null,
              revogadoMotivo: est.revogado_motivo || null,
              protocoloLanceLivre: est.protocolo_lance_livre || null,
              protocoloLanceFixo: est.protocolo_lance_fixo || null,
              protocoloSegundoLanceFixo: est.protocolo_segundo_lance_fixo || null,
              assembleiaNumero: est.assembleia_numero || null,
              assembleiaData: est.assembleia_data || null,
              repetirSeisAssembleias: Boolean(est.repetir_seis_assembleias),
              ultimoLanceOfertadoEm: est.ultimo_lance_ofertado_em || null,
              ofertaOrigem: est.oferta_origem || null,
            }
          : null,
        situacaoOperacional: situacao,
        diasParaVencimento,
        historico: hist.map((h) => ({
          id: h.id,
          createdAt: h.created_at,
          motivo: h.motivo,
          estadoNovo: h.estado_novo || {},
        })),
      };
    });

    const statusNaoOperacional = (row: CotaLanceOperacionalDTO) =>
      row.contemplada || ["contemplada", "cancelada"].includes(row.statusCota.toLowerCase());

    const stats: LancesDashboardStats = {
      totalCotas: allRows.length,
      comLanceAtivo: allRows.filter((r) => !statusNaoOperacional(r) && r.estrategia?.ativa && r.situacaoOperacional !== "SEM_ESTRATEGIA").length,
      semEstrategia: allRows.filter((r) => !statusNaoOperacional(r) && r.situacaoOperacional === "SEM_ESTRATEGIA").length,
      vencendoTrintaDias: allRows.filter((r) => !statusNaoOperacional(r) && r.situacaoOperacional === "VENCENDO").length,
      vencidos: allRows.filter((r) => !statusNaoOperacional(r) && r.situacaoOperacional === "VENCIDO").length,
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
  const { empresaAtiva, usuario } = await requireErpRouteAccess("lances");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const cotaId = String(formData.get("cota_id") ?? "");
  if (!cotaId) throw new Error("ID da cota obrigatório.");

  const num = (k: string) => {
    const v = formData.get(k);
    if (!v) return null;
    let clean = String(v).replace(/[R$\s]/g, "").trim();
    if (!clean) return null;
    if (clean.includes(".") && clean.includes(",")) {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else if (clean.includes(",")) {
      clean = clean.replace(",", ".");
    }
    const n = Number(clean);
    return isNaN(n) ? null : n;
  };

  const normalizeDate = (dStr: string) => {
    if (!dStr) return null;
    const s = dStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split("/");
      return `${y}-${m}-${d}`;
    }
    return s;
  };

  // A configuração não é um lance realizado. As datas só devem ser
  // preenchidas pelo retorno do robô/confirmador após a oferta efetiva.
  const dataLance = normalizeDate(String(formData.get("data_lance") ?? "").trim());
  const dataVencimento = normalizeDate(String(formData.get("data_vencimento") ?? "").trim());

  const lanceFixoAtivo = formData.get("lance_fixo_ativo") === "on";
  const segundoLanceFixoAtivo = formData.get("segundo_lance_fixo_ativo") === "on";
  const lanceFidelidadeAtivo = formData.get("lance_fidelidade_ativo") === "on";
  const lanceLivreAtivo = formData.get("lance_livre_ativo") === "on";
  const lanceLivreUsarMaximo = formData.get("lance_livre_usar_maximo") === "on";
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
  const lanceLivreEmbutidoPercentual = num("lance_livre_embutido_percentual");
  const lanceFixoEmbutidoPercentual = num("lance_fixo_embutido_percentual");
  const segundoLanceFixoEmbutidoPercentual = num("segundo_lance_fixo_embutido_percentual");
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

  const adminSupabase = createAdminClient();

  if (comprovanteFile && comprovanteFile.size > 0) {
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

  // Buscar cota para validação de crédito e regras de grupo
  const { data: cota, error: cotaErr } = await adminSupabase
    .from("cotas_definitivas")
    .select("valor_credito, snapshot_cota, grupo_id, grupo:grupos_consorcio(percentual_lance_embutido, modalidades:grupos_modalidades_lance(nome,ativo,percentual_lance_embutido))")
    .eq("id", cotaId)
    .eq("empresa_id", empresaAtiva.id)
    .single();
  if (cotaErr || !cota) throw new Error("Cota não encontrada nesta empresa.");

  const grupo = Array.isArray(cota.grupo) ? cota.grupo[0] : cota.grupo;
  const modalidadesDoGrupo = (Array.isArray(grupo?.modalidades) ? grupo.modalidades : grupo?.modalidades ? [grupo.modalidades] : [])
    .filter((modalidade: any) => modalidade?.ativo !== false);
  if (lanceFixoAtivo && !modalidadeHabilitada(modalidadesDoGrupo, "FIXO")) throw new Error("Este grupo não possui lance fixo habilitado.");
  if (segundoLanceFixoAtivo && !modalidadeHabilitada(modalidadesDoGrupo, "SEGUNDO_FIXO")) throw new Error("Este grupo não possui segundo lance fixo habilitado.");
  if (lanceFidelidadeAtivo && !modalidadeHabilitada(modalidadesDoGrupo, "FIDELIDADE")) throw new Error("Este grupo não possui lance fidelidade habilitado.");
  if (lanceLivreAtivo && !modalidadeHabilitada(modalidadesDoGrupo, "LIVRE")) throw new Error("Este grupo não possui lance livre habilitado.");

  const { data: resultadosGrupo } = cota.grupo_id
    ? await adminSupabase.from("grupo_assembleias_resultados").select("assembleia_numero, cotas").eq("grupo_id", cota.grupo_id).order("assembleia_numero", { ascending: false })
    : { data: [] };
  const maxLanceLivre = maxLanceLivreUltimaAssembleia(resultadosGrupo as Array<{ assembleia_numero?: number | null; cotas?: unknown }>);
  if (lanceLivrePercentual && maxLanceLivre && lanceLivrePercentual > maxLanceLivre + 0.0001) {
    throw new Error(`O lance livre informado (${lanceLivrePercentual}%) ultrapassa o máximo registrado na última assembleia (${maxLanceLivre.toFixed(4)}%).`);
  }

  const maxEmbutidoLivre = Math.round(Math.max(
    Number(grupo?.percentual_lance_embutido || 0),
    ...modalidadesDoGrupo
      .filter((modalidade: any) => String(modalidade?.nome ?? "").toUpperCase().includes("LIVRE"))
      .map((modalidade: any) => Number(modalidade?.percentual_lance_embutido || 0)),
  ));
  // Só usa automaticamente o teto quando o operador marca essa opção.
  const lanceLivrePercentualEfetivo = lanceLivreAtivo && lanceLivreUsarMaximo && maxLanceLivre ? maxLanceLivre : lanceLivrePercentual;
  const lanceLivreEmbutidoPercentualEfetivo = lanceLivreAtivo && lanceLivreUsarMaximo && maxLanceLivre && maxEmbutidoLivre > 0
    ? maxEmbutidoLivre
    : lanceLivreEmbutidoPercentual;

  const snapshotCota = cota.snapshot_cota && typeof cota.snapshot_cota === "object" ? (cota.snapshot_cota as Record<string, unknown>) : null;
  const opcaoCotaId = typeof snapshotCota?.opcao_cota_id === "string" ? snapshotCota.opcao_cota_id : null;
  const { data: opcaoCota } = opcaoCotaId
    ? await adminSupabase.from("grupos_cotas").select("saldo_devedor").eq("id", opcaoCotaId).maybeSingle()
    : { data: null };
  const saldoDevedor = saldoDevedorPorCota(cota, opcaoCota?.saldo_devedor);
  const lanceLivrePercentualCalculado = lanceLivrePercentualEfetivo ?? (
    lanceLivreValor && saldoDevedor > 0 ? Number(((lanceLivreValor / saldoDevedor) * 100).toFixed(4)) : null
  );
  const lanceLivreValorEfetivo = lanceLivrePercentualCalculado && saldoDevedor > 0
    ? Number(((saldoDevedor * lanceLivrePercentualCalculado) / 100).toFixed(2))
    : lanceLivreValor;
  const recursoProprioValorEfetivo = lanceLivreAtivo && lanceLivreUsarMaximo && maxLanceLivre && saldoDevedor > 0
    ? Number((saldoDevedor * Math.max(lanceLivrePercentualCalculado! - lanceLivreEmbutidoPercentualEfetivo!, 0) / 100).toFixed(2))
    : recursoProprioValor;
  const lanceEmbutidoValorCalculado =
    lanceEmbutidoPercentual && saldoDevedor > 0 ? Number(((saldoDevedor * lanceEmbutidoPercentual) / 100).toFixed(2)) : null;

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
    lance_livre_percentual: lanceLivrePercentualCalculado,
    lance_livre_valor: lanceLivreValorEfetivo,
    recurso_proprio_valor: recursoProprioValorEfetivo,
    lance_embutido_percentual: lanceEmbutidoPercentual,
    lance_embutido_valor: lanceEmbutidoValorCalculado,
    lance_livre_embutido_percentual: lanceLivreEmbutidoPercentualEfetivo,
    lance_fixo_embutido_percentual: lanceFixoEmbutidoPercentual,
    segundo_lance_fixo_embutido_percentual: segundoLanceFixoEmbutidoPercentual,
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
  const { data: estadoAnterior } = await adminSupabase
    .from("cota_estrategias_lance")
    .select("*")
    .eq("cota_definitiva_id", cotaId)
    .maybeSingle();

  const { data: saved, error: saveErr } = await adminSupabase
    .from("cota_estrategias_lance")
    .upsert(dadosUpsert, { onConflict: "cota_definitiva_id" })
    .select("id")
    .single();

  if (saveErr) throw new Error(`Erro ao salvar estratégia: ${saveErr.message}`);

  // Inserir histórico
  await adminSupabase.from("cota_estrategias_lance_historico").insert({
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
  const { empresaAtiva } = await requireErpRouteAccess("lances");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.rpc("rpc_confirmar_lance_cota", {
    p_empresa_id: empresaAtiva.id,
    p_cota_id: cotaId,
    p_observacao: observacao || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/erp/lances");
  revalidatePath("/erp");
}

export async function revogarConfirmacaoLanceOperacionalAction(cotaId: string, motivo: string) {
  const { empresaAtiva } = await requireErpRouteAccess("lances");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.rpc("rpc_revogar_confirmacao_lance_cota", {
    p_empresa_id: empresaAtiva.id,
    p_cota_id: cotaId,
    p_motivo: motivo,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/erp/lances");
  revalidatePath("/erp");
}

export async function alterarStatusCotaLanceAction(
  cotaId: string,
  status: "contemplada" | "cancelada",
) {
  const { empresaAtiva, usuario } = await requireErpRouteAccess("lances");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const adminSupabase = createAdminClient();
  const { data: cota, error: cotaError } = await adminSupabase
    .from("cotas_definitivas")
    .select("id, empresa_id, status, contemplada")
    .eq("id", cotaId)
    .eq("empresa_id", empresaAtiva.id)
    .maybeSingle();

  if (cotaError) throw new Error(cotaError.message);
  if (!cota) throw new Error("Cota não encontrada para a empresa ativa.");

  const novoStatus = status === "contemplada" ? "contemplada" : "cancelada";
  const { error: updateCotaError } = await adminSupabase
    .from("cotas_definitivas")
    .update({ status: novoStatus, contemplada: status === "contemplada" })
    .eq("id", cotaId)
    .eq("empresa_id", empresaAtiva.id);

  if (updateCotaError) throw new Error(updateCotaError.message);

  const { data: estrategia, error: estrategiaError } = await adminSupabase
    .from("cota_estrategias_lance")
    .select("id, ativa")
    .eq("cota_definitiva_id", cotaId)
    .maybeSingle();

  if (estrategiaError) throw new Error(estrategiaError.message);

  if (estrategia) {
    const { error: estrategiaUpdateError } = await adminSupabase
      .from("cota_estrategias_lance")
      .update({ ativa: false })
      .eq("id", estrategia.id);

    if (estrategiaUpdateError) throw new Error(estrategiaUpdateError.message);

    const { error: historicoError } = await adminSupabase.from("cota_estrategias_lance_historico").insert({
      empresa_id: empresaAtiva.id,
      estrategia_id: estrategia.id,
      cota_definitiva_id: cotaId,
      estado_anterior: { ativa: estrategia.ativa },
      estado_novo: { ativa: false, status_cota: novoStatus },
      motivo: `Cota marcada como ${status} na tela de Lances e Estratégias`,
      usuario_id: usuario?.id || null,
    });

    if (historicoError) throw new Error(historicoError.message);
  }

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
