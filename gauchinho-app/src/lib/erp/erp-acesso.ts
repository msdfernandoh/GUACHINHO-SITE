import { ERP_MODULES, type ErpModuleId, type ErpSistemaConfig } from "./erp-modulos";
import {
  ERP_OPERATIONAL_ROUTES,
  erpOperationalRouteEnabled,
  type ErpOperationalRoute,
} from "./erp-operational";

export type ErpAccessId = ErpModuleId | ErpOperationalRoute["id"];

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

export function canAccessErpRoute(
  config: ErpSistemaConfig,
  raw: unknown,
  routeId: string,
): routeId is ErpAccessId {
  return resolveErpUserAccess(config, raw).includes(routeId as ErpAccessId);
}
