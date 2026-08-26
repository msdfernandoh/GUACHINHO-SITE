import "server-only";

import { notFound } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "./erp-modulos";
import { canAuthorizedAccessErpRoute, resolveAuthorizedErpUserAccess, type ErpAccessId } from "./erp-acesso";

export async function getCurrentErpAccess() {
  const context = await getCurrentTenantContext();
  const config = getErpSistemaConfig(context.empresaAtiva?.configuracoes);
  const vinculo = (context.vinculos ?? []).find((item) => item.empresa_id === context.empresaAtiva?.id);
  const raw = vinculo?.erp_modulos_visiveis ?? null;
  const authorization = { papelCodigo: vinculo?.papel?.codigo, permissoes: context.permissoes };
  return {
    ...context,
    config,
    vinculo,
    allowedAccess: resolveAuthorizedErpUserAccess(config, raw, authorization),
  };
}

export async function requireErpRouteAccess(routeId: ErpAccessId) {
  const access = await getCurrentErpAccess();
  if (
    !access.usuario ||
    !access.empresaAtiva ||
    !canAuthorizedAccessErpRoute(
      access.config,
      access.vinculo?.erp_modulos_visiveis,
      routeId,
      { papelCodigo: access.vinculo?.papel?.codigo, permissoes: access.permissoes },
    )
  ) {
    notFound();
  }
  return access as typeof access & {
    usuario: NonNullable<typeof access.usuario>;
    empresaAtiva: NonNullable<typeof access.empresaAtiva>;
    vinculo: NonNullable<typeof access.vinculo>;
  };
}
