export type SitePublicoConfig = {
  operacionalHabilitado: boolean;
};

export function getSitePublicoConfig(
  configuracoes: unknown,
): SitePublicoConfig {
  const root = configuracoes && typeof configuracoes === "object"
    ? configuracoes as Record<string, unknown>
    : {};
  const site = root.site_publico && typeof root.site_publico === "object"
    ? root.site_publico as Record<string, unknown>
    : {};
  return { operacionalHabilitado: site.operacional_habilitado === true };
}

export function mergeSitePublicoConfig(
  configuracoes: unknown,
  input: SitePublicoConfig,
): Record<string, unknown> {
  const root = configuracoes && typeof configuracoes === "object"
    ? configuracoes as Record<string, unknown>
    : {};
  const current = root.site_publico && typeof root.site_publico === "object"
    ? root.site_publico as Record<string, unknown>
    : {};
  return {
    ...root,
    site_publico: {
      ...current,
      operacional_habilitado: input.operacionalHabilitado,
    },
  };
}
