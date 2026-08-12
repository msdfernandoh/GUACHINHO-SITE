"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Boxes, CreditCard, FileStack, Globe2, LayoutDashboard, Landmark, Layers3, ScrollText, Settings2, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const sections = [
  ["Visão geral", [["/platform", "Dashboard", LayoutDashboard]]],
  ["Franquias / Empresas", [["/platform/empresas", "Master Franquias", Building2], ["/platform/usuarios", "Usuários / Responsáveis", Users], ["/platform/dominios", "Domínios", Globe2]]],
  ["Catálogo global", [["/platform/administradoras", "Administradoras", Landmark], ["/platform/grupos", "Grupos", Layers3], ["/platform/produtos", "Produtos comerciais", Boxes]]],
  ["Sites & Portais", [["/platform/sites", "Sites / Portais", Globe2], ["/platform/templates", "Modelos de Site", FileStack]]],
  ["ERP / Recursos", [["/platform/erp-modulos", "Catálogo de módulos", Settings2], ["/platform/recursos", "Liberações e overrides", Boxes]]],
  ["Planos SaaS", [["/platform/planos", "Planos", CreditCard], ["/platform/assinaturas", "Assinaturas SaaS", ScrollText]]],
  ["Governança", [["/platform/auditoria", "Auditoria", ScrollText], ["/platform/configuracoes", "Configurações", Settings2]]],
] as const;

export function PlatformSidebar() {
  const pathname = usePathname();
  return <aside className="w-72 shrink-0 border-r border-slate-200 bg-slate-950 text-slate-200 dark:border-slate-800">
    <div className="border-b border-slate-800 px-5 py-5"><p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-400">Plataforma SaaS</p><p className="mt-1 text-sm text-slate-400">Governança Master</p></div>
    <nav className="space-y-5 p-4">{sections.map(([title, items]) => <section key={title}><p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p><div className="space-y-1">{items.map(([href,label,Icon]) => { const active = href === "/platform" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm", active ? "bg-cyan-500 text-slate-950" : "hover:bg-slate-800")}><Icon className="h-4 w-4"/>{label}</Link>; })}</div></section>)}</nav>
  </aside>;
}
