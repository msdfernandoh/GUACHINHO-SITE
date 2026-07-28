/** Chaves de menu do painel admin (sidebar). */
export const ADMIN_MENU_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/admin" },
  { key: "leads", label: "Leads", href: "/admin/leads" },
  { key: "agenda", label: "Agenda", href: "/admin/agenda" },
  { key: "agenda_disponibilidade", label: "Disponibilidade", href: "/admin/agenda/disponibilidade" },
  { key: "eventos", label: "Eventos", href: "/admin/eventos" },
  { key: "listas_convidados", label: "Listas convidados", href: "/admin/eventos/listas-convidados" },
  { key: "relatorios", label: "Relatórios", href: "/admin/relatorios" },
  { key: "propostas", label: "Propostas", href: "/admin/propostas" },
  { key: "contratacoes", label: "Contratações", href: "/admin/contratacoes" },
  { key: "grupos", label: "Grupos", href: "/admin/grupos" },
  { key: "cartas", label: "Cartas Contempladas", href: "/admin/cartas-contempladas" },
  { key: "imobiliarias", label: "Imobiliárias", href: "/admin/imobiliarias" },
  { key: "seguradoras", label: "Seguradoras", href: "/admin/seguradoras" },
  { key: "imoveis", label: "Imóveis", href: "/admin/imoveis" },
  { key: "conteudo", label: "Conteúdo", href: "/admin/conteudo" },
  { key: "usuarios", label: "Usuários", href: "/admin/usuarios" },
  { key: "indices", label: "Índices financeiros", href: "/admin/indices-financeiros" },
  { key: "configuracoes", label: "Configurações", href: "/admin/configuracoes" },
] as const;

export type AdminMenuKey = (typeof ADMIN_MENU_ITEMS)[number]["key"];

const DEFAULT_MENUS_BY_PERFIL: Record<string, AdminMenuKey[]> = {
  master: ADMIN_MENU_ITEMS.map((m) => m.key),
  srd: [
    "dashboard",
    "leads",
    "agenda",
    "agenda_disponibilidade",
    "eventos",
    "listas_convidados",
    "relatorios",
    "propostas",
    "contratacoes",
    "grupos",
    "cartas",
    "imoveis",
    "conteudo",
    "indices",
  ],
  visualizador: [
    "dashboard",
    "leads",
    "agenda",
    "agenda_disponibilidade",
    "relatorios",
    "propostas",
    "contratacoes",
    "grupos",
    "cartas",
    "imoveis",
  ],
  imobiliaria: ["imoveis"],
};

export function resolveAdminMenus(
  perfil: string,
  adminMenus: AdminMenuKey[] | null | undefined,
): AdminMenuKey[] {
  if (adminMenus?.length) return adminMenus;
  return DEFAULT_MENUS_BY_PERFIL[perfil] ?? DEFAULT_MENUS_BY_PERFIL.srd;
}

export function menuKeyFromHref(href: string): AdminMenuKey | null {
  if (href === "/admin") return "dashboard";
  const sorted = [...ADMIN_MENU_ITEMS].sort((a, b) => b.href.length - a.href.length);
  for (const item of sorted) {
    if (item.href === "/admin") continue;
    if (href === item.href || href.startsWith(`${item.href}/`)) return item.key;
  }
  return null;
}

export function canAccessAdminHref(
  href: string,
  perfil: string,
  allowedMenus: AdminMenuKey[],
): boolean {
  if (perfil === "imobiliaria") {
    return href.startsWith("/admin/minha-imobiliaria") || href.startsWith("/admin/imoveis");
  }
  const key = menuKeyFromHref(href);
  if (!key) return perfil === "master";
  return allowedMenus.includes(key);
}
