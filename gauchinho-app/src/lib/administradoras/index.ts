import "server-only";

export type {
  Administradora,
  AdministradoraAutorizada,
  AdministradoraStatus,
  EmpresaAdministradora,
  EmpresaAdministradoraStatus,
} from "./types";

export {
  ADMINISTRADORA_NOT_FOUND_MESSAGE,
  ADMINISTRADORA_STATUS,
  AUDIT_ACTIONS_ADMINISTRADORAS,
  EMPRESA_ADMINISTRADORA_STATUS,
  EMPRESA_B_ID,
  FASE4_PERMISSOES,
  GAUCHINHO_EMPRESA_ID,
  RACON_ADMINISTRADORA_ID,
  RACON_SLUG,
} from "./constants";

export {
  AdministradoraNotFoundError,
  isAdministradoraNotFoundError,
  throwAdministradoraNotFound,
} from "./errors";

export {
  concessaoPermiteUso,
  filterAdministradorasAutorizadasForEmpresa,
  normalizeAdministradoraSlug,
  papelPodeListarCatalogoGlobal,
  papelTemPermissaoFase4,
  resolveAutorizadaById,
  resolveAutorizadaBySlug,
  toAdministradoraAutorizada,
} from "./rules";

export {
  assertCallerCanAccessEmpresa,
  hasGerenciarAdministradorasEmpresa,
  hasGerenciarCatalogoAdministradoras,
  requireGerenciarAdministradorasEmpresa,
  requireGerenciarCatalogoAdministradoras,
  requirePermissaoAdministradorasEmpresa,
  requirePermissaoCatalogoAdministradoras,
} from "./authorization";

export {
  assertAdministradoraGlobalAtiva,
  assertEmpresaPodeUsarAdministradora,
  getAdministradoraAutorizadaById,
  getAdministradoraAutorizadaBySlug,
  listAdministradorasAutorizadasForEmpresa,
  listAdministradorasGlobaisForSuperadmin,
} from "./service";

export {
  countEmpresasVinculadasForAdministradora,
  createAdministradoraGlobal,
  getAdministradoraGlobalByIdForSuperadmin,
  listEmpresasFranqueadasVinculadas,
  setAdministradoraGlobalStatus,
  updateAdministradoraGlobal,
} from "./mutations";

export {
  diffAdministradoraFields,
  mapAdministradoraDbUniqueError,
  validateAdministradoraWriteInput,
} from "./rules";

export { writeAdministradorasAuditLog } from "./audit";
