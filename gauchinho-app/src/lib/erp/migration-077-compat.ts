const ERP_USER_LINK_COLUMNS = /socio_pagador|erp_modulos_visiveis|is_consultor|leads_apenas_proprios|agenda_acesso_todos|google_agenda_sync|admin_menus|imobiliaria_id/i;
const MISSING_COLUMN_ERROR = /does not exist|could not find|schema cache|42703/i;

export function isMissingErpUserLinkColumns(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown } | null | undefined;
  const details = `${String(candidate?.code ?? "")} ${String(candidate?.message ?? "")}`;
  return ERP_USER_LINK_COLUMNS.test(details) && MISSING_COLUMN_ERROR.test(details);
}
