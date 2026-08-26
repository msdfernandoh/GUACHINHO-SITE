import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ProdutoMapeado = {
  valor_credito: number;
  grupo_cota_id: string | null;
  status_produto: "ENCONTRADO" | "NAO_ENCONTRADO_NO_SAAS" | "AMBIGUO_NO_SAAS";
};

export type GrupoLegadoItem = {
  identificador: string;
  origem: string;
  administradora: string | null;
  tipo_bem: string | null;
  total_contratacoes: number;
  total_propostas: number;
  creditos: number[];
  status_vinculo: "SUGESTAO_INELUDIVEL" | "PENDENTE" | "AMBIGUO" | "VINCULADO";
  grupo_saas_sugerido: {
    id: string;
    codigo_grupo: string;
    administradora_nome: string;
    tipo_nome: string | null;
    modalidade_nome: string | null;
    status: string;
    produtos: {
      id: string;
      valor_credito: number;
    }[];
  } | null;
  produtos_mapeamento: ProdutoMapeado[];
  candidatos_grupos_saas: {
    id: string;
    codigo_grupo: string;
    administradora_nome: string;
    tipo_nome: string | null;
  }[];
};

export type HistoricoVinculacao = {
  id: string;
  origem: string;
  identificador_legado: string;
  grupo_consorcio_id: string;
  produtos_mapeamento: ProdutoMapeado[];
  contratacoes_afetadas: number;
  created_at: string;
  observacoes: string | null;
  grupo?: {
    codigo_grupo: string;
    administradora?: { nome: string };
  };
};

export async function listarGruposLegados(empresaId: string): Promise<{
  itens: GrupoLegadoItem[];
  historico: HistoricoVinculacao[];
  totalPendentes: number;
  totalSugestoes: number;
}> {
  const admin = await createClient();

  const [
    { data: contratacoes },
    { data: propostas },
    { data: gruposSaas },
    { data: cotasSaas },
    { data: historicoRows }
  ] = await Promise.all([
    admin.from("contratacoes_online").select("id,protocolo,origem,grupo_id,grupo_nome,administradora,tipo_bem,credito_selecionado,dados_simulacao").eq("empresa_id", empresaId),
    admin.from("propostas").select("id,dados_simulacao,valor_credito,tipo_proposta").eq("empresa_id", empresaId),
    admin.from("grupos_consorcio").select("id,codigo_grupo,administradora_id,tipo_administradora_id,modalidade,status,ativo,administradora:administradoras(nome),tipo:administradora_tipos(nome),modalidade_comissao:administradora_modalidades_comissao(nome)"),
    admin.from("grupos_cotas").select("id,grupo_id,valor_credito,ativo,status"),
    admin.from("grupos_vinculacoes_legadas_historico").select("*,grupo:grupos_consorcio(codigo_grupo,administradora:administradoras(nome))").eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(20)
  ]);

  const grupos = (gruposSaas ?? []) as any[];
  const cotas = (cotasSaas ?? []) as any[];

  // Mapa de cotas por grupo
  const cotasPorGrupo = new Map<string, any[]>();
  for (const c of cotas) {
    const list = cotasPorGrupo.get(c.grupo_id) || [];
    list.push(c);
    cotasPorGrupo.set(c.grupo_id, list);
  }

  // Agrupamento legado
  const legadosMap = new Map<string, {
    identificador: string;
    origem: string;
    administradora: string | null;
    tipo_bem: string | null;
    total_contratacoes: number;
    total_propostas: number;
    creditos: Set<number>;
    temGrupoCanonico: boolean;
  }>();

  for (const c of contratacoes ?? []) {
    const nome = c.grupo_nome || c.dados_simulacao?.grupo_nome || c.dados_simulacao?.codigoGrupo || (c.grupo_id ? null : "Simulador / Sem Grupo");
    if (!nome) continue;

    const key = nome.trim();
    const existing = legadosMap.get(key) || {
      identificador: key,
      origem: c.origem || "site_grupos",
      administradora: c.administradora || null,
      tipo_bem: c.tipo_bem || c.dados_simulacao?.tipoBem || null,
      total_contratacoes: 0,
      total_propostas: 0,
      creditos: new Set<number>(),
      temGrupoCanonico: Boolean(c.grupo_id && grupos.some((g) => g.id === c.grupo_id))
    };

    existing.total_contratacoes++;
    const cred = Number(c.credito_selecionado || c.dados_simulacao?.valor_credito || c.dados_simulacao?.somaCotas || 0);
    if (cred > 0) existing.creditos.add(cred);
    if (c.grupo_id) existing.temGrupoCanonico = true;

    legadosMap.set(key, existing);
  }

  for (const proposta of propostas ?? []) {
    const dados = (proposta.dados_simulacao ?? {}) as Record<string, unknown>;
    const grupoId = typeof dados.grupoId === "string" ? dados.grupoId : null;
    const nomeRaw = dados.grupo_nome ?? dados.codigoGrupo ?? dados.grupoNome;
    const nome = typeof nomeRaw === "string" && nomeRaw.trim() ? nomeRaw.trim() : null;
    if (!nome || (grupoId && grupos.some((grupo) => grupo.id === grupoId))) continue;

    const existing = legadosMap.get(nome) || {
      identificador: nome,
      origem: "propostas",
      administradora: typeof dados.administradora === "string" ? dados.administradora : null,
      tipo_bem: typeof dados.tipoBem === "string" ? dados.tipoBem : proposta.tipo_proposta ?? null,
      total_contratacoes: 0,
      total_propostas: 0,
      creditos: new Set<number>(),
      temGrupoCanonico: false,
    };
    existing.total_propostas += 1;
    const credito = Number(
      proposta.valor_credito ?? dados.valor_credito ?? dados.somaCotas ?? 0,
    );
    if (Number.isFinite(credito) && credito > 0) existing.creditos.add(credito);
    legadosMap.set(nome, existing);
  }

  const itens: GrupoLegadoItem[] = [];

  for (const leg of legadosMap.values()) {
    const creditosArray = Array.from(leg.creditos).sort((a, b) => a - b);
    const cleanNum = leg.identificador.replace(/\D/g, "");

    // Buscar candidatos no SaaS
    const candidatos = grupos.filter((g) => {
      if (cleanNum && g.codigo_grupo === cleanNum) return true;
      if (g.codigo_grupo.toLowerCase() === leg.identificador.toLowerCase()) return true;
      return false;
    });

    let grupoSugerido: GrupoLegadoItem["grupo_saas_sugerido"] = null;
    let statusVinculo: GrupoLegadoItem["status_vinculo"] = "PENDENTE";

    if (leg.temGrupoCanonico) {
      statusVinculo = "VINCULADO";
    } else if (candidatos.length === 1) {
      const g = candidatos[0];
      const gCotas = cotasPorGrupo.get(g.id) || [];
      grupoSugerido = {
        id: g.id,
        codigo_grupo: g.codigo_grupo,
        administradora_nome: g.administradora?.nome || "Administradora",
        tipo_nome: g.tipo?.nome || null,
        modalidade_nome: g.modalidade_comissao?.nome || null,
        status: g.status,
        produtos: gCotas.map((ct) => ({
          id: ct.id,
          valor_credito: Number(ct.valor_credito),
        }))
      };
      statusVinculo = "SUGESTAO_INELUDIVEL";
    } else if (candidatos.length > 1) {
      statusVinculo = "AMBIGUO";
    }

    // Mapeamento de produtos
    const gProdutos = grupoSugerido?.produtos || [];
    const produtos_mapeamento: ProdutoMapeado[] = creditosArray.map((cred) => {
      const matches = gProdutos.filter((p) => Math.abs(p.valor_credito - cred) < 0.01);
      if (matches.length === 1) {
        return {
          valor_credito: cred,
          grupo_cota_id: matches[0].id,
          status_produto: "ENCONTRADO"
        };
      }
      if (matches.length > 1) {
        return {
          valor_credito: cred,
          grupo_cota_id: null,
          status_produto: "AMBIGUO_NO_SAAS",
        };
      }
      return {
        valor_credito: cred,
        grupo_cota_id: null,
        status_produto: "NAO_ENCONTRADO_NO_SAAS"
      };
    });

    itens.push({
      identificador: leg.identificador,
      origem: leg.origem,
      administradora: leg.administradora,
      tipo_bem: leg.tipo_bem,
      total_contratacoes: leg.total_contratacoes,
      total_propostas: leg.total_propostas,
      creditos: creditosArray,
      status_vinculo: statusVinculo,
      grupo_saas_sugerido: grupoSugerido,
      produtos_mapeamento,
      candidatos_grupos_saas: candidatos.map((c) => ({
        id: c.id,
        codigo_grupo: c.codigo_grupo,
        administradora_nome: c.administradora?.nome || "Administradora",
        tipo_nome: c.tipo?.nome || null
      }))
    });
  }

  const totalPendentes = itens.filter((i) => i.status_vinculo !== "VINCULADO").length;
  const totalSugestoes = itens.filter((i) => i.status_vinculo === "SUGESTAO_INELUDIVEL").length;

  return {
    itens,
    historico: (historicoRows ?? []) as any[],
    totalPendentes,
    totalSugestoes
  };
}

export async function vincularGrupoLegado(payload: {
  empresa_id: string;
  origem: string;
  identificador_legado: string;
  grupo_consorcio_id: string;
  produtos_mapeamento: ProdutoMapeado[];
  atualizar_contratacoes?: boolean;
  observacoes?: string;
}) {
  const admin = await createClient();
  const { data, error } = await admin.rpc("rpc_vincular_grupo_legado", {
    p_empresa_id: payload.empresa_id,
    p_origem: payload.origem,
    p_identificador_legado: payload.identificador_legado,
    p_grupo_consorcio_id: payload.grupo_consorcio_id,
    p_produtos_mapeamento: payload.produtos_mapeamento,
    p_atualizar_contratacoes: payload.atualizar_contratacoes ?? true,
    p_observacoes: payload.observacoes || null
  });

  if (error) throw new Error(error.message);
  return data;
}
