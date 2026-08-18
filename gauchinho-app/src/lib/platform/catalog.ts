export const PLATFORM_SECTIONS = new Set(["empresas","usuarios","dominios","administradoras","grupos","produtos","produtos-comerciais","sites","templates","erp-modulos","recursos","planos","assinaturas","auditoria","configuracoes"]);
export function isPlatformSection(value: string) { return PLATFORM_SECTIONS.has(value); }
