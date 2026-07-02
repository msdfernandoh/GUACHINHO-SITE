export type HomeModuloId =
  | "hero"
  | "simulador_rapido"
  | "beneficios"
  | "grupos"
  | "contempladas"
  | "imoveis"
  | "seguradoras"
  | "parceiros"
  | "dicas"
  | "casos"
  | "cta_final";

export type HomeModuloConfigItem = {
  id: HomeModuloId;
  nome: string;
  ativo: boolean;
  ordem: number;
};

export type HomeModulosConfig = {
  modulos: HomeModuloConfigItem[];
};

export const DEFAULT_HOME_MODULOS: HomeModulosConfig = {
  modulos: [
    { id: "hero", nome: "Hero principal", ativo: true, ordem: 1 },
    { id: "simulador_rapido", nome: "Simulador rápido", ativo: true, ordem: 2 },
    { id: "beneficios", nome: "Calculadoras financeiras", ativo: true, ordem: 3 },
    { id: "grupos", nome: "Grupos em destaque", ativo: true, ordem: 4 },
    { id: "contempladas", nome: "Cartas contempladas", ativo: true, ordem: 5 },
    { id: "imoveis", nome: "Imóveis", ativo: true, ordem: 6 },
    { id: "seguradoras", nome: "Seguradoras", ativo: true, ordem: 7 },
    { id: "parceiros", nome: "Parceiros", ativo: true, ordem: 8 },
    { id: "dicas", nome: "Dicas do Tchê", ativo: true, ordem: 9 },
    { id: "casos", nome: "Casos de sucesso", ativo: true, ordem: 10 },
    { id: "cta_final", nome: "CTA final", ativo: true, ordem: 11 },
  ],
};

const DEFAULT_BY_ID = new Map(DEFAULT_HOME_MODULOS.modulos.map((m) => [m.id, m]));

export function normalizeHomeModulosConfig(raw: unknown): HomeModulosConfig {
  const r = raw as { modulos?: Partial<HomeModuloConfigItem>[] } | null | undefined;
  if (!r?.modulos?.length) return DEFAULT_HOME_MODULOS;

  const merged: HomeModuloConfigItem[] = DEFAULT_HOME_MODULOS.modulos.map((base) => {
    const found = r.modulos!.find((x) => x.id === base.id);
    if (!found) return base;
    return {
      ...base,
      ativo: found.ativo ?? base.ativo,
      ordem: typeof found.ordem === "number" ? found.ordem : base.ordem,
      nome: found.nome ?? base.nome,
    };
  });

  return { modulos: merged };
}

export function modulosHomeAtivosOrdenados(config: HomeModulosConfig): HomeModuloConfigItem[] {
  return [...config.modulos]
    .filter((m) => m.ativo)
    .sort((a, b) => a.ordem - b.ordem || DEFAULT_BY_ID.get(a.id)!.ordem - DEFAULT_BY_ID.get(b.id)!.ordem);
}

export function isHomeModuloAtivo(config: HomeModulosConfig, id: HomeModuloId): boolean {
  return config.modulos.find((m) => m.id === id)?.ativo ?? DEFAULT_BY_ID.get(id)?.ativo ?? true;
}

/** Ordem CSS flex; módulos inativos ficam ocultos. */
export function homeModuloFlexOrder(config: HomeModulosConfig, id: HomeModuloId): number {
  if (!isHomeModuloAtivo(config, id)) return 9999;
  const m = config.modulos.find((x) => x.id === id);
  return m?.ordem ?? DEFAULT_BY_ID.get(id)?.ordem ?? 999;
}

export function homeModuloSectionClass(config: HomeModulosConfig, id: HomeModuloId): string {
  return isHomeModuloAtivo(config, id) ? "" : "hidden";
}
