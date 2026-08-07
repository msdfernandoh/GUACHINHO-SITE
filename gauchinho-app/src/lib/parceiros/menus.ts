import { getTemplate } from "./templates";

/** Catálogo controlado de menus/páginas — sem rotas admin ou externas livres. */
export const MENU_CATALOGO = [
  { codigo: "INICIO", label: "Início", rotaPublica: "/" },
  { codigo: "QUEM_SOMOS", label: "Quem somos", rotaPublica: "/quem-somos" },
  { codigo: "CONSORCIO", label: "Consórcio", rotaPublica: "/consorcio" },
  { codigo: "SIMULADOR", label: "Simulador", rotaPublica: "/simulador" },
  { codigo: "GRUPOS", label: "Grupos", rotaPublica: "/grupos" },
  { codigo: "CARTAS_CONTEMPLADAS", label: "Cartas contempladas", rotaPublica: "/cartas-contempladas" },
  { codigo: "IMOVEIS", label: "Imóveis", rotaPublica: "/oportunidades-imobiliarias" },
  { codigo: "EVENTOS", label: "Eventos", rotaPublica: "/eventos" },
  { codigo: "CALCULADORAS", label: "Calculadoras", rotaPublica: "/calculadoras" },
  { codigo: "INDICACAO", label: "Indicação", rotaPublica: "/indicar" },
  { codigo: "CONTATO", label: "Contato", rotaPublica: "/contato" },
] as const;

export type MenuCodigo = (typeof MENU_CATALOGO)[number]["codigo"];

export const MENU_CODIGOS = MENU_CATALOGO.map((m) => m.codigo);

export type MenuLiberado = {
  codigo: MenuCodigo;
  habilitado: boolean;
  ordem: number;
};

export function isMenuCodigo(codigo: string): codigo is MenuCodigo {
  return (MENU_CODIGOS as readonly string[]).includes(codigo);
}

/** Rejeita menus fora da allowlist do template e do catálogo global. */
export function validateMenusForTemplate(
  templateCodigo: string,
  menus: Array<{ codigo: string; habilitado?: boolean }>
): { ok: true; menus: MenuLiberado[] } | { ok: false; error: string } {
  const template = getTemplate(templateCodigo);
  if (!template) return { ok: false, error: "Template inválido." };

  const seen = new Set<string>();
  const result: MenuLiberado[] = [];

  for (let i = 0; i < menus.length; i++) {
    const codigo = menus[i].codigo;
    if (!isMenuCodigo(codigo)) {
      return { ok: false, error: `Menu não permitido: ${codigo}` };
    }
    if (!(template.menusPermitidos as readonly string[]).includes(codigo)) {
      return { ok: false, error: `Menu ${codigo} não permitido no template ${templateCodigo}.` };
    }
    if (seen.has(codigo)) {
      return { ok: false, error: `Menu duplicado: ${codigo}` };
    }
    seen.add(codigo);
    result.push({
      codigo,
      habilitado: menus[i].habilitado !== false,
      ordem: i,
    });
  }

  return { ok: true, menus: result };
}

export function parseMenusFromForm(raw: FormDataEntryValue[]): MenuLiberado[] {
  const selected = raw.map(String).filter(isMenuCodigo);
  return selected.map((codigo, ordem) => ({ codigo, habilitado: true, ordem }));
}
