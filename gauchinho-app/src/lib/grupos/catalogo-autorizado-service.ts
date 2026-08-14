import { createAdminClient } from "@/lib/supabase/admin";
import { fetchConcessoesComAdministradoraByEmpresa } from "@/lib/administradoras/repository";
import {
  assertCotaDoGrupo,
  assertGrupoAutorizadoPorIds,
  filterAdministradoraIdsAutorizadas,
  grupoElegivelCatalogo,
  parseSelecoesGrupoFromDadosSimulacao,
  throwCotaNotFound,
  throwGrupoNotFound,
} from "./catalogo-autorizado";
import {
  fetchEmpresaGruposConfigMap,
  resolveEmpresaGrupoPresentation,
} from "./empresa-grupos-config";
import type {
  GrupoConsorcio,
  GrupoCota,
  GrupoModalidadeLance,
  PublicGrupoAggregate,
} from "@/lib/types";

export type CatalogoAutorizadoDeps = {
  fetchConcessoes: typeof fetchConcessoesComAdministradoraByEmpresa;
  adminFrom: () => ReturnType<typeof createAdminClient>;
};

const defaultDeps: CatalogoAutorizadoDeps = {
  fetchConcessoes: fetchConcessoesComAdministradoraByEmpresa,
  adminFrom: createAdminClient,
};

export async function listAdministradoraIdsAutorizadasForEmpresa(
  empresaId: string,
  deps: CatalogoAutorizadoDeps = defaultDeps,
): Promise<string[]> {
  const concessoes = await deps.fetchConcessoes(empresaId);
  const mapped = concessoes.map((r) => ({
    administradora_id: r.concessao.administradora_id,
    status: r.concessao.status,
    administradora_status: r.administradora?.status ?? null,
  }));
  return filterAdministradoraIdsAutorizadas(mapped);
}

export async function listGruposAutorizadosForEmpresa(
  empresaId: string,
  opts?: { incluirInativos?: boolean },
  deps: CatalogoAutorizadoDeps = defaultDeps,
): Promise<GrupoConsorcio[]> {
  const adminIds = await listAdministradoraIdsAutorizadasForEmpresa(empresaId, deps);
  if (adminIds.length === 0) return [];

  const admin = deps.adminFrom();
  let q = admin
    .from("grupos_consorcio")
    .select("*")
    .in("administradora_id", adminIds)
    .not("administradora_id", "is", null)
    .order("codigo_grupo", { ascending: true });

  if (!opts?.incluirInativos) {
    q = q.eq("ativo", true).neq("status", "Inativo");
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rawGrupos = ((data ?? []) as GrupoConsorcio[]).filter((grupo) =>
    grupo.origem_governanca !== "LOCAL" || grupo.empresa_origem_id === empresaId
  );

  if (opts?.incluirInativos) {
    return rawGrupos.filter((g) => Boolean(g.administradora_id));
  }

  // Aplica a reconciliação com a configuração de apresentação local (empresa_grupos_config)
  const configMap = await fetchEmpresaGruposConfigMap(empresaId, deps);
  const result: GrupoConsorcio[] = [];

  for (const g of rawGrupos) {
    if (!grupoElegivelCatalogo(g)) continue;
    const config = configMap.get(g.id);
    const presentation = resolveEmpresaGrupoPresentation(g, config);

    if (presentation.exibirAoPublico) {
      result.push(g);
    }
  }

  return result;
}

export async function getGrupoAutorizadoForEmpresa(
  empresaId: string,
  grupoId: string,
  deps: CatalogoAutorizadoDeps = defaultDeps,
): Promise<GrupoConsorcio> {
  if (!grupoId) throwGrupoNotFound();
  const adminIds = await listAdministradoraIdsAutorizadasForEmpresa(empresaId, deps);
  if (adminIds.length === 0) throwGrupoNotFound();

  const admin = deps.adminFrom();
  const { data, error } = await admin
    .from("grupos_consorcio")
    .select("*")
    .eq("id", grupoId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  assertGrupoAutorizadoPorIds(data as GrupoConsorcio | null, new Set(adminIds));
  if (data && data.origem_governanca === "LOCAL" && data.empresa_origem_id !== empresaId) throwGrupoNotFound();
  return data as GrupoConsorcio;
}

export async function assertEmpresaPodeAcessarGrupo(
  empresaId: string,
  grupoId: string,
  deps: CatalogoAutorizadoDeps = defaultDeps,
): Promise<GrupoConsorcio> {
  return getGrupoAutorizadoForEmpresa(empresaId, grupoId, deps);
}

export async function listCotasAutorizadasForEmpresa(
  empresaId: string,
  grupoId: string,
  deps: CatalogoAutorizadoDeps = defaultDeps,
): Promise<GrupoCota[]> {
  await assertEmpresaPodeAcessarGrupo(empresaId, grupoId, deps);
  const admin = deps.adminFrom();
  const { data, error } = await admin
    .from("grupos_cotas")
    .select("*")
    .eq("grupo_id", grupoId)
    .eq("ativo", true)
    .neq("status", "Inativo")
    .neq("status", "Esgotado")
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GrupoCota[];
}

export async function getCotaAutorizadaForEmpresa(
  empresaId: string,
  grupoId: string,
  cotaId: string,
  deps: CatalogoAutorizadoDeps = defaultDeps,
): Promise<GrupoCota> {
  await assertEmpresaPodeAcessarGrupo(empresaId, grupoId, deps);
  if (!cotaId) throwCotaNotFound();
  const admin = deps.adminFrom();
  const { data, error } = await admin
    .from("grupos_cotas")
    .select("*")
    .eq("id", cotaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  assertCotaDoGrupo(data as GrupoCota | null, grupoId);
  return data as GrupoCota;
}

export async function listModalidadesAutorizadasForEmpresa(
  empresaId: string,
  grupoId: string,
  deps: CatalogoAutorizadoDeps = defaultDeps,
): Promise<GrupoModalidadeLance[]> {
  await assertEmpresaPodeAcessarGrupo(empresaId, grupoId, deps);
  const admin = deps.adminFrom();
  const { data, error } = await admin
    .from("grupos_modalidades_lance")
    .select("*")
    .eq("grupo_id", grupoId)
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GrupoModalidadeLance[];
}

/**
 * Agregados públicos tenant-scoped com reconciliação de apresentacao local (empresa_grupos_config).
 */
export async function fetchPublicGruposAggregatesForEmpresa(
  empresaId: string,
  deps: CatalogoAutorizadoDeps = defaultDeps,
): Promise<PublicGrupoAggregate[]> {
  const grupos = await listGruposAutorizadosForEmpresa(empresaId, undefined, deps);
  if (grupos.length === 0) return [];

  const configMap = await fetchEmpresaGruposConfigMap(empresaId, deps);
  const grupoIds = grupos.map((g) => g.id);
  const admin = deps.adminFrom();
  const [{ data: cotas, error: cErr }, { data: modalidades, error: mErr }] = await Promise.all([
    admin
      .from("grupos_cotas")
      .select("*")
      .in("grupo_id", grupoIds)
      .eq("ativo", true)
      .neq("status", "Inativo")
      .neq("status", "Esgotado")
      .order("ordem", { ascending: true }),
    admin
      .from("grupos_modalidades_lance")
      .select("*")
      .in("grupo_id", grupoIds)
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
  ]);
  if (cErr) throw new Error(cErr.message);
  if (mErr) throw new Error(mErr.message);

  const cotasByGrupo = new Map<string, GrupoCota[]>();
  for (const c of (cotas ?? []) as GrupoCota[]) {
    const list = cotasByGrupo.get(c.grupo_id) ?? [];
    list.push(c);
    cotasByGrupo.set(c.grupo_id, list);
  }
  const modsByGrupo = new Map<string, GrupoModalidadeLance[]>();
  for (const m of (modalidades ?? []) as GrupoModalidadeLance[]) {
    const list = modsByGrupo.get(m.grupo_id) ?? [];
    list.push(m);
    modsByGrupo.set(m.grupo_id, list);
  }

  const aggregates: PublicGrupoAggregate[] = [];
  for (const g of grupos) {
    const list = cotasByGrupo.get(g.id) ?? [];
    if (!list.length) continue;
    list.sort((a, b) => Number(b.valor_credito) - Number(a.valor_credito));

    // Reconcilia overrides locais de titulo e visibilidade
    const config = configMap.get(g.id);
    const presentation = resolveEmpresaGrupoPresentation(g, config);

    aggregates.push({
      grupo: {
        ...g,
        ...(presentation.tituloComercial ? { titulo_comercial: presentation.tituloComercial } : {}),
      },
      cotas: list,
      modalidades: modsByGrupo.get(g.id) ?? [],
    });
  }

  // Ordenação final: respeita ordemLocal se informada
  aggregates.sort((a, b) => {
    const cfgA = configMap.get(a.grupo.id);
    const cfgB = configMap.get(b.grupo.id);
    const ordemA = cfgA?.ordem ?? 999;
    const ordemB = cfgB?.ordem ?? 999;
    if (ordemA !== ordemB) return ordemA - ordemB;
    return a.grupo.codigo_grupo.localeCompare(b.grupo.codigo_grupo);
  });

  return aggregates;
}

/**
 * Valida seleções do fluxo público (grupo+cota) contra concessões da empresa.
 * Retorna NOT_FOUND uniforme se qualquer item for proibido.
 */
export async function assertSelecoesAutorizadasForEmpresa(
  empresaId: string,
  selecoes: Array<{ grupoId: string; cotaId: string }>,
  deps: CatalogoAutorizadoDeps = defaultDeps,
): Promise<{
  grupos: Map<string, GrupoConsorcio>;
  cotas: Map<string, GrupoCota>;
  modalidades: Map<string, GrupoModalidadeLance[]>;
}> {
  const adminIds = await listAdministradoraIdsAutorizadasForEmpresa(empresaId, deps);
  if (adminIds.length === 0) throwGrupoNotFound();
  const allowed = new Set(adminIds);

  const grupoIds = [...new Set(selecoes.map((s) => s.grupoId))];
  const cotaIds = selecoes.map((s) => s.cotaId);
  const admin = deps.adminFrom();

  const [{ data: grupos }, { data: cotas }, { data: modalidades }] = await Promise.all([
    admin.from("grupos_consorcio").select("*").in("id", grupoIds),
    admin.from("grupos_cotas").select("*").in("id", cotaIds),
    admin.from("grupos_modalidades_lance").select("*").in("grupo_id", grupoIds).eq("ativo", true),
  ]);

  const grupoMap = new Map<string, GrupoConsorcio>();
  for (const g of (grupos ?? []) as GrupoConsorcio[]) {
    assertGrupoAutorizadoPorIds(g, allowed);
    grupoMap.set(g.id, g);
  }

  const cotaMap = new Map<string, GrupoCota>();
  for (const s of selecoes) {
    if (!grupoMap.has(s.grupoId)) throwGrupoNotFound();
    const cota = ((cotas ?? []) as GrupoCota[]).find((c) => c.id === s.cotaId) ?? null;
    assertCotaDoGrupo(cota, s.grupoId);
    cotaMap.set(cota.id, cota);
  }

  const modsByGrupo = new Map<string, GrupoModalidadeLance[]>();
  for (const m of (modalidades ?? []) as GrupoModalidadeLance[]) {
    if (!grupoMap.has(m.grupo_id)) continue;
    const list = modsByGrupo.get(m.grupo_id) ?? [];
    list.push(m);
    modsByGrupo.set(m.grupo_id, list);
  }

  return { grupos: grupoMap, cotas: cotaMap, modalidades: modsByGrupo };
}

/** Valida snapshot de contratação/proposta com origem grupos (server-side). */
export async function assertDadosSimulacaoGruposAutorizadosForEmpresa(
  empresaId: string,
  dados: Record<string, unknown>,
  deps: CatalogoAutorizadoDeps = defaultDeps,
): Promise<void> {
  const selecoes = parseSelecoesGrupoFromDadosSimulacao(dados);
  if (!selecoes.length) throwGrupoNotFound();
  await assertSelecoesAutorizadasForEmpresa(empresaId, selecoes, deps);
}
