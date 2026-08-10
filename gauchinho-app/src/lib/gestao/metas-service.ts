import { createAdminClient } from "@/lib/supabase/admin";

export type MetaCommercialRow = {
  id: string;
  empresa_id: string;
  titulo: string;
  alvo_tipo: "empresa" | "equipe" | "participante" | "parceiro";
  alvo_id: string | null;
  indicador:
    | "valor_credito_vendido"
    | "quantidade_vendas"
    | "propostas_criadas"
    | "receita_prevista_franquia"
    | "receita_recebida";
  periodo_tipo: "mensal" | "trimestral" | "anual" | "personalizado";
  data_inicio: string;
  data_fim: string;
  valor_meta: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  valor_realizado?: number;
  percentual_atingimento?: number;
};

export async function listMetasForEmpresa(empresaId: string): Promise<MetaCommercialRow[]> {
  const admin = createAdminClient();

  const { data: metas, error } = await admin
    .from("metas_comerciais")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("data_inicio", { ascending: false });

  if (error) {
    throw new Error(`Erro ao listar metas comerciais: ${error.message}`);
  }

  const result: MetaCommercialRow[] = [];
  for (const meta of metas || []) {
    const apuracao = await calcularApuracaoMeta(empresaId, meta.id);
    result.push({
      ...meta,
      valor_realizado: apuracao.valor_realizado,
      percentual_atingimento: apuracao.percentual_atingimento,
    });
  }

  return result;
}

export async function createMeta(
  empresaId: string,
  data: {
    titulo: string;
    alvo_tipo: "empresa" | "equipe" | "participante" | "parceiro";
    alvo_id?: string;
    indicador:
      | "valor_credito_vendido"
      | "quantidade_vendas"
      | "propostas_criadas"
      | "receita_prevista_franquia"
      | "receita_recebida";
    periodo_tipo: "mensal" | "trimestral" | "anual" | "personalizado";
    data_inicio: string;
    data_fim: string;
    valor_meta: number;
    observacoes?: string;
  },
): Promise<MetaCommercialRow> {
  const admin = createAdminClient();

  const { data: meta, error } = await admin
    .from("metas_comerciais")
    .insert({
      empresa_id: empresaId,
      titulo: data.titulo,
      alvo_tipo: data.alvo_tipo,
      alvo_id: data.alvo_id || null,
      indicador: data.indicador,
      periodo_tipo: data.periodo_tipo,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      valor_meta: data.valor_meta,
      observacoes: data.observacoes || null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao criar meta comercial: ${error.message}`);
  }

  return meta as MetaCommercialRow;
}

export async function calcularApuracaoMeta(
  empresaId: string,
  metaId: string,
): Promise<{ valor_realizado: number; percentual_atingimento: number }> {
  const admin = createAdminClient();

  const { data: meta } = await admin
    .from("metas_comerciais")
    .select("*")
    .eq("id", metaId)
    .eq("empresa_id", empresaId)
    .single();

  if (!meta) {
    return { valor_realizado: 0, percentual_atingimento: 0 };
  }

  let realizado = 0;
  const startIso = `${meta.data_inicio}T00:00:00.000Z`;
  const endIso = `${meta.data_fim}T23:59:59.999Z`;

  switch (meta.indicador) {
    case "valor_credito_vendido": {
      let query = admin
        .from("vendas")
        .select("valor_credito")
        .eq("empresa_id", empresaId)
        .eq("status", "efetivada")
        .gte("created_at", startIso)
        .lte("created_at", endIso);

      if (meta.alvo_tipo === "participante" && meta.alvo_id) {
        query = query.eq("participante_comercial_id", meta.alvo_id);
      } else if (meta.alvo_tipo === "parceiro" && meta.alvo_id) {
        query = query.eq("organizacao_parceira_id", meta.alvo_id);
      }

      const { data: vendas } = await query;
      realizado = (vendas || []).reduce((acc: number, v: any) => acc + Number(v.valor_credito || 0), 0);
      break;
    }

    case "quantidade_vendas": {
      let query = admin
        .from("vendas")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status", "efetivada")
        .gte("created_at", startIso)
        .lte("created_at", endIso);

      if (meta.alvo_tipo === "participante" && meta.alvo_id) {
        query = query.eq("participante_comercial_id", meta.alvo_id);
      } else if (meta.alvo_tipo === "parceiro" && meta.alvo_id) {
        query = query.eq("organizacao_parceira_id", meta.alvo_id);
      }

      const { count } = await query;
      realizado = count || 0;
      break;
    }

    case "propostas_criadas": {
      let query = admin
        .from("propostas")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .gte("created_at", startIso)
        .lte("created_at", endIso);

      if (meta.alvo_tipo === "parceiro" && meta.alvo_id) {
        query = query.eq("organizacao_parceira_id", meta.alvo_id);
      }

      const { count } = await query;
      realizado = count || 0;
      break;
    }

    case "receita_prevista_franquia": {
      const { data: previsoes } = await admin
        .from("comissao_previsoes_franquia")
        .select("valor_previso")
        .eq("empresa_id", empresaId)
        .gte("created_at", startIso)
        .lte("created_at", endIso);

      realizado = (previsoes || []).reduce((acc: number, p: any) => acc + Number(p.valor_previso || 0), 0);
      break;
    }

    case "receita_recebida": {
      const { data: recebimentos } = await admin
        .from("financeiro_recebimentos")
        .select("valor_total")
        .eq("empresa_id", empresaId)
        .gte("data_recebimento", meta.data_inicio)
        .lte("data_recebimento", meta.data_fim);

      realizado = (recebimentos || []).reduce((acc: number, r: any) => acc + Number(r.valor_total || 0), 0);
      break;
    }

    default:
      realizado = 0;
  }

  const metaValue = Number(meta.valor_meta || 0);
  const percentual = metaValue > 0 ? Number(((realizado / metaValue) * 100).toFixed(2)) : 0;

  return {
    valor_realizado: Number(realizado.toFixed(2)),
    percentual_atingimento: percentual,
  };
}
