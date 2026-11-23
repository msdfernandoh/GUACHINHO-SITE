import type { createClient } from "@/lib/supabase/server";
import type { listarGruposParaAssembleias } from "@/lib/erp/grupos-assembleias";
import { indicadoresContemplacoes, resultadosVigentes, type ResultadoAssembleia } from "@/lib/erp/contemplacoes";

type Supa = Awaited<ReturnType<typeof createClient>>;
type GrupoAssembleia = Awaited<ReturnType<typeof listarGruposParaAssembleias>>[number];

export async function carregarResultados(supabase: Supa, grupoIds: string[], mesAno?: string) {
  const rows: ResultadoAssembleia[] = [];
  if (!grupoIds.length) return rows;
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("grupo_assembleias_resultados")
      .select("id, grupo_id, assembleia_numero, assembleia_data, criado_em, cotas")
      .in("grupo_id", grupoIds).order("id").range(offset, offset + 499);
    if (mesAno) {
      const [ano, mes] = mesAno.split("-").map(Number);
      const fim = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
      query = query.gte("assembleia_data", mesAno + "-01").lt("assembleia_data", fim);
    }
    const { data, error } = await query;
    if (error) throw new Error("Resultados verificados indisponíveis. A importação corrigida precisa estar instalada. " + error.message);
    rows.push(...(data ?? []) as ResultadoAssembleia[]);
    if ((data ?? []).length < 500) break;
  }
  return resultadosVigentes(rows);
}


/** Indicadores por grupo (média 3m, contempladas, a contemplar) a partir dos grupos já carregados. */
export async function resumoGruposAssembleia(supabase: Supa, grupos: GrupoAssembleia[]) {
  const resultados = await carregarResultados(supabase, grupos.map((g) => g.id));
  const porGrupo = new Map<string, ResultadoAssembleia[]>();
  for (const resultado of resultados) {
    const grupo = porGrupo.get(resultado.grupo_id) ?? [];
    grupo.push(resultado);
    porGrupo.set(resultado.grupo_id, grupo);
  }
  return Object.fromEntries(grupos.map((grupo) => {
    const dados = grupo as typeof grupo & {
      ultima_assembleia_numero?: number | null;
      dados_estatisticos?: { cotas_ativas?: number } | null;
      contemplacoes_resumo?: { versao?: number; sem_assembleias_realizadas?: boolean } | null;
    };
    const rows = porGrupo.get(grupo.id) ?? [];
    const ultima = Math.max(Number(dados.ultima_assembleia_numero) || 0, ...rows.map((row) => row.assembleia_numero));
    const ativas = dados.dados_estatisticos?.cotas_ativas;
    const semAssembleias = dados.contemplacoes_resumo?.versao === 2 && dados.contemplacoes_resumo.sem_assembleias_realizadas === true;
    const indicadores = indicadoresContemplacoes(rows, ultima, ativas == null ? null : Number(ativas), semAssembleias);
    return [grupo.id, {
      media3m: indicadores.media_lance_3m,
      contempladas: indicadores.cotas_entregues,
      aContemplar: indicadores.cotas_a_entregar,
      ultima: ultima > 0 || semAssembleias ? ultima : null,
      totalAssembleias: grupo.prazo_total,
    }] as const;
  }));
}

