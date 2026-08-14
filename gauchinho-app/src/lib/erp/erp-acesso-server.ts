import "server-only";

import { notFound } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "./erp-modulos";
import { canAccessErpRoute, resolveErpUserAccess, type ErpAccessId } from "./erp-acesso";

export async function getCurrentErpAccess() {
  const context = await getCurrentTenantContext();
  const config = getErpSistemaConfig(context.empresaAtiva?.configuracoes);
  const vinculo = (context.vinculos ?? []).find((item) => item.empresa_id === context.empresaAtiva?.id);
  const raw = vinculo?.erp_modulos_visiveis ?? null;
  return { ...context, config, vinculo, allowedAccess: resolveErpUserAccess(config, raw) };
}

export async function requireErpRouteAccess(routeId: ErpAccessId) {
  const access = await getCurrentErpAccess();
  if (!access.usuario || !access.empresaAtiva || !canAccessErpRoute(access.config, access.vinculo?.erp_modulos_visiveis, routeId)) {
    notFound();
  }
  return access;
}
