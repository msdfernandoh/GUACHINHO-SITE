"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  FileText,
  Layers,
  Settings,
  Building2,
  Home,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const staffNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/propostas", label: "Propostas", icon: FileText },
  { href: "/admin/grupos", label: "Grupos", icon: Layers },
  { href: "/admin/cartas-contempladas", label: "Cartas Contempladas", icon: FileText },
  { href: "/admin/imobiliarias", label: "Imobiliárias", icon: Building2, masterOnly: true },
  { href: "/admin/imoveis", label: "Imóveis", icon: Home },
  { href: "/admin/conteudo", label: "Conteúdo", icon: BookOpen, conteudoOnly: true },
  { href: "/admin/usuarios", label: "Usuários", icon: UserCircle, masterOnly: true },
  { href: "/admin/indices-financeiros", label: "Índices financeiros", icon: TrendingUp, masterOnly: true },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings, masterOnly: true },
];

const imobiliariaNav = [
  { href: "/admin/minha-imobiliaria", label: "Minha imobiliária", icon: Building2 },
  { href: "/admin/imoveis", label: "Meus imóveis", icon: Home },
];

export function AdminSidebar({ perfil }: { perfil: string }) {
  const pathname = usePathname();
  const isMaster = perfil === "master";
  const isImob = perfil === "imobiliaria";
  const canConteudo = perfil === "master" || perfil === "srd";
  const nav = isImob ? imobiliariaNav : staffNav;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800">
        <Link href="/admin" className="block transition-opacity hover:opacity-90">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Gauchinho</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {isImob ? "Área parceiro" : "Painel admin"}
          </p>
        </Link>
        <Link
          href="/"
          className="mt-2 inline-block text-xs text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400"
        >
          Ver site →
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          if ("masterOnly" in item && item.masterOnly && !isMaster) return null;
          if ("conteudoOnly" in item && item.conteudoOnly && !canConteudo) return null;
          const active =
            "exact" in item && item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                  : "text-zinc-700 hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
