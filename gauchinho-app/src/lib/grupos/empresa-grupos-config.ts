import { createAdminClient } from "@/lib/supabase/admin";
import { fetchConcessoesComAdministradoraByEmpresa } from "@/lib/administradoras/repository";
import { filterAdministradoraIdsAutorizadas } from "./catalogo-autorizado";
import type { GrupoConsorcio } from "@/lib/types";

export type EmpresaGrupoConfig = {
  id: string;
  empresa_id: string;
  grupo_id: string;
  visivel: boolean;
  destaque: boolean;
  ordem: number | null;
  titulo_comercial: string | null;
  descricao_comercial: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GrupoPresentationResolved = {
  grupo: GrupoConsorcio;
  visivelLocal: boolean;
  destaqueLocal: boolean;
  ordemLocal: number | null;
  tituloComercial: string;
  descricaoComercial: string | null;
  /** Indica se o grupo está efetivamente elegível para ser exibido ao público do tenant. */
  exibirAoPublico: boolean;
};

export type EmpresaGrupoConfigDeps = {
  fetchConcessoes: typeof fetchConcessoesComAdministradoraByEmpresa;
  adminFrom: () => ReturnType<typeof createAdminClient>;
};

const defaultDeps: EmpresaGrupoConfigDeps = {
  fetchConcessoes: fetchConcessoesComAdministradoraByEmpresa,
  adminFrom: createAdminClient,
};

/**
 * Valida se a empresa possui concessão ATIVA para a administradora proprietária do grupo.
 */
export async function assertEmpresaTemConcessaoParaGrupo(
  empresaId: string,
  grupoId: string,
  deps: EmpresaGrupoConfigDeps = defaultDeps,
): Promise<{ grupo: GrupoConsorcio; administradoraId: string }> {
  const admin = deps.adminFrom();
  const { data: grupo, error } = await admin
    .from("grupos_consorcio")
    .select("*")
    .eq("id", grupoId)
    .maybeSingle();

  if (error || !grupo) {
    throw new Error("Grupo não encontrado.");
  }

  if (!grupo.administradora_id) {
    throw new Error("Grupo sem administradora_id vinculada.");
  }

  const concessoes = await deps.fetchConcessoes(empresaId);
  const autorizadas = filterAdministradoraIdsAutorizadas(
    concessoes.map((r) => ({
      administradora_id: r.concessao.administradora_id,
      status: r.concessao.status,
      administradora_status: r.administradora?.status ?? null,
    })),
  );

  if (!autorizadas.includes(grupo.administradora_id)) {
    throw new Error("Empresa não possui concessão ativa para a administradora deste grupo.");
  }

  return { grupo: grupo as GrupoConsorcio, administradoraId: grupo.administradora_id };
}

/**
 * Obtém a configuração de apresentação local empresa x grupo, se existir.
 */
export async function getEmpresaGrupoConfig(
  empresaId: string,
  grupoId: string,
  deps: EmpresaGrupoConfigDeps = defaultDeps,
): Promise<EmpresaGrupoConfig | null> {
  const admin = deps.adminFrom();
  const { data, error } = await admin
    .from("empresa_grupos_config")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("grupo_id", grupoId)
    .maybeSingle();

  if (error) return null;
  return (data as EmpresaGrupoConfig) ?? null;
}

/**
 * Busca o mapa completo de configurações de apresentação local de uma empresa indexado por grupo_id.
 */
export async function fetchEmpresaGruposConfigMap(
  empresaId: string,
  deps: EmpresaGrupoConfigDeps = defaultDeps,
): Promise<Map<string, EmpresaGrupoConfig>> {
  const admin = deps.adminFrom();
  const { data, error } = await admin
    .from("empresa_grupos_config")
    .select("*")
    .eq("empresa_id", empresaId);

  const map = new Map<string, EmpresaGrupoConfig>();
  if (error || !data) return map;

  for (const row of data as EmpresaGrupoConfig[]) {
    map.set(row.grupo_id, row);
  }
  return map;
}

/**
 * Reconcilia o grupo global oficial com a configuração local da empresa.
 * A configuração local NUNCA pode ampliar permissões se o grupo global ou concessão estiverem inativos.
 */
export function resolveEmpresaGrupoPresentation(
  grupo: GrupoConsorcio,
  config?: EmpresaGrupoConfig | null,
): GrupoPresentationResolved {
  const globalElegivel = grupo.ativo && grupo.status === "Disponível";
  const visivelConfig = config ? config.visivel : true;

  // A visibilidade final exige elegibilidade global E visibilidade local
  const exibirAoPublico = globalElegivel && visivelConfig;

  return {
    grupo,
    visivelLocal: visivelConfig,
    destaqueLocal: config ? config.destaque : false,
    ordemLocal: config?.ordem ?? null,
    tituloComercial: config?.titulo_comercial || `Grupo ${grupo.codigo_grupo}`,
    descricaoComercial: config?.descricao_comercial ?? null,
    exibirAoPublico,
  };
}

/**
 * Salva ou atualiza a configuração de apresentação local da empresa para um grupo concedido.
 */
export async function upsertEmpresaGrupoConfig(
  empresaId: string,
  grupoId: string,
  payload: {
    visivel?: boolean;
    destaque?: boolean;
    ordem?: number | null;
    titulo_comercial?: string | null;
    descricao_comercial?: string | null;
  },
  deps: EmpresaGrupoConfigDeps = defaultDeps,
): Promise<EmpresaGrupoConfig> {
  // Valida obrigatoriamente a concessão antes de salvar
  await assertEmpresaTemConcessaoParaGrupo(empresaId, grupoId, deps);

  const admin = deps.adminFrom();
  const existing = await getEmpresaGrupoConfig(empresaId, grupoId, deps);

  const row = {
    empresa_id: empresaId,
    grupo_id: grupoId,
    visivel: payload.visivel ?? existing?.visivel ?? true,
    destaque: payload.destaque ?? existing?.destaque ?? false,
    ordem: payload.ordem !== undefined ? payload.ordem : existing?.ordem ?? null,
    titulo_comercial: payload.titulo_comercial !== undefined ? payload.titulo_comercial : existing?.titulo_comercial ?? null,
    descricao_comercial: payload.descricao_comercial !== undefined ? payload.descricao_comercial : existing?.descricao_comercial ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("empresa_grupos_config")
    .upsert(row, { onConflict: "empresa_id,grupo_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as EmpresaGrupoConfig;
}

/**
 * Remove a configuração de apresentação local da empresa (Restaurar Padrão Global).
 */
export async function deleteEmpresaGrupoConfig(
  empresaId: string,
  grupoId: string,
  deps: EmpresaGrupoConfigDeps = defaultDeps,
): Promise<{ ok: true }> {
  // Valida obrigatoriamente a concessão antes de remover
  await assertEmpresaTemConcessaoParaGrupo(empresaId, grupoId, deps);

  const admin = deps.adminFrom();
  const { error } = await admin
    .from("empresa_grupos_config")
    .delete()
    .eq("empresa_id", empresaId)
    .eq("grupo_id", grupoId);

  if (error) throw new Error(error.message);
  return { ok: true };
}
