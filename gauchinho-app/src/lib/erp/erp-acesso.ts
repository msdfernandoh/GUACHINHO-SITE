import { ERP_MODULES, type ErpModuleId, type ErpSistemaConfig } from "./erp-modulos";
import {
  ERP_OPERATIONAL_ROUTES,
  erpOperationalRouteEnabled,
  type ErpOperationalRoute,
} from "./erp-operational";

export type ErpAccessId = ErpModuleId | ErpOperationalRoute["id"];

export type ErpPapelCodigo =
  | "super_admin"
  | "admin_empresa"
  | "gestor"
  | "consultor"
  | "visualizador";

type ErpAuthorization = {
  papelCodigo?: string | null;
  permissoes?: Iterable<string> | null;
};

export const ERP_ACCESS_ITEMS: Array<{ id: ErpAccessId; label: string; href: string }> = [
  ...ERP_MODULES.map(({ id, label, href }) => ({ id, label, href })),
  ...ERP_OPERATIONAL_ROUTES.map(({ id, label, href }) => ({ id, label, href })),
];

const ERP_ACCESS_IDS = new Set<string>(ERP_ACCESS_ITEMS.map((item) => item.id));

export function normalizeErpAccessIds(raw: unknown): ErpAccessId[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is ErpAccessId => typeof id === "string" && ERP_ACCESS_IDS.has(id)))];
}

export function listTenantErpAccessIds(config: ErpSistemaConfig): ErpAccessId[] {
  if (!config.habilitado) return [];
  const base = ERP_MODULES.filter((module) => config.modulos.includes(module.id)).map(
    (module) => module.id,
  );
  const operational = ERP_OPERATIONAL_ROUTES.filter((route) =>
    erpOperationalRouteEnabled(config, route.id),
  ).map((route) => route.id);
  return [...new Set([...base, ...operational])];
}

export function resolveErpUserAccess(
  config: ErpSistemaConfig,
  raw: unknown,
): ErpAccessId[] {
  const tenantAccess = listTenantErpAccessIds(config);
  const configured = normalizeErpAccessIds(raw);
  if (configured == null) return tenantAccess;
  const allowed = new Set(configured);
  return tenantAccess.filter((id) => allowed.has(id));
}

const ERP_PAPEIS = new Set<ErpPapelCodigo>([
  "super_admin",
  "admin_empresa",
  "gestor",
  "consultor",
  "visualizador",
]);

const ERP_ROUTE_PERMISSIONS: Record<ErpAccessId, string[]> = {
  painel: [],
  leads: ["gerenciar_leads"],
  propostas: ["gerenciar_propostas"],
  contratacoes: ["gerenciar_propostas", "formalizar_vendas"],
  vendas: ["gerenciar_propostas", "formalizar_vendas"],
  grupos: ["gerenciar_grupos", "gerenciar_propostas"],
  comissoes: ["gerenciar_comissoes"],
  financeiro: ["gerenciar_financeiro"],
  relatorios: ["acessar_relatorios"],
  metas: ["acessar_relatorios"],
  tarefas: ["gerenciar_leads"],
  usuarios: ["gerenciar_usuarios"],
  clientes: ["gerenciar_leads", "gerenciar_propostas"],
  consultores: ["gerenciar_usuarios", "gerenciar_comissoes"],
  lances: ["gerenciar_grupos", "gerenciar_leads"],
  assembleias: ["gerenciar_grupos", "gerenciar_leads"],
  "regras-comissao": ["gerenciar_comissoes"],
  "repasse-franquia": ["gerenciar_comissoes", "gerenciar_financeiro"],
  "minhas-comissoes": ["gerenciar_comissoes"],
  "contas-pagar": ["gerenciar_financeiro"],
};

/**
 * Segunda barreira do ERP: menus contratados e selecionados nunca ampliam o
 * papel canônico. Parceiros usam a área de parceiro e não herdam o ERP quando
 * `erp_modulos_visiveis` é nulo.
 */
export function canRoleAccessErpRoute(
  routeId: ErpAccessId,
  authorization: ErpAuthorization,
): boolean {
  const papel = authorization.papelCodigo as ErpPapelCodigo | null | undefined;
  if (!papel || !ERP_PAPEIS.has(papel)) return false;
  if (papel === "super_admin" || papel === "admin_empresa") return true;
  if (routeId === "painel") return true;
  if (routeId === "minhas-comissoes" && papel === "consultor") return true;
  const permissoes = new Set(authorization.permissoes ?? []);
  return ERP_ROUTE_PERMISSIONS[routeId].some((codigo) => permissoes.has(codigo));
}

export function resolveAuthorizedErpUserAccess(
  config: ErpSistemaConfig,
  raw: unknown,
  authorization: ErpAuthorization,
): ErpAccessId[] {
  return resolveErpUserAccess(config, raw).filter((routeId) =>
    canRoleAccessErpRoute(routeId, authorization),
  );
}

export function canAuthorizedAccessErpRoute(
  config: ErpSistemaConfig,
  raw: unknown,
  routeId: string,
  authorization: ErpAuthorization,
): routeId is ErpAccessId {
  return resolveAuthorizedErpUserAccess(config, raw, authorization).includes(routeId as ErpAccessId);
}

export function canAccessErpRoute(
  config: ErpSistemaConfig,
  raw: unknown,
  routeId: string,
): routeId is ErpAccessId {
  return resolveErpUserAccess(config, raw).includes(routeId as ErpAccessId);
}
