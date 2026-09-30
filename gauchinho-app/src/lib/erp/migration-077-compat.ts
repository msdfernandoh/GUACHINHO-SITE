// Algumas bases ainda não receberam as evoluções 077 e 101. Todas estas
// colunas são opcionais para o vínculo básico usuário × empresa; tratá-las
// como indisponíveis evita que a página de usuários vire um erro 500 após um
// salvamento em uma base ainda em atualização.
const ERP_USER_LINK_COLUMNS = /socio_pagador|pode_estornar_contas|erp_modulos_visiveis|is_consultor|leads_apenas_proprios|agenda_acesso_todos|google_agenda_sync|admin_menus|imobiliaria_id/i;
const MISSING_COLUMN_ERROR = /does not exist|could not find|schema cache|42703/i;

export function isMissingErpUserLinkColumns(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown } | null | undefined;
  const details = `${String(candidate?.code ?? "")} ${String(candidate?.message ?? "")}`;
  return ERP_USER_LINK_COLUMNS.test(details) && MISSING_COLUMN_ERROR.test(details);
}
