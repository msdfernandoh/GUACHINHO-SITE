const ERP_USER_LINK_COLUMNS = /socio_pagador|erp_modulos_visiveis/i;
const MISSING_COLUMN_ERROR = /does not exist|could not find|schema cache|42703/i;

export function isMissingErpUserLinkColumns(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown } | null | undefined;
  const details = `${String(candidate?.code ?? "")} ${String(candidate?.message ?? "")}`;
  return ERP_USER_LINK_COLUMNS.test(details) && MISSING_COLUMN_ERROR.test(details);
}
