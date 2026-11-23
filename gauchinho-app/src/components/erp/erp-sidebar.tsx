"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, BadgeDollarSign, Menu, X, Bot, BriefcaseBusiness, Building2, CircleDollarSign, LayoutDashboard, Scale, Settings2, TicketCheck, Users, WalletCards } from "lucide-react";
import { ERP_MODULES, type ErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { listEnabledOperationalRoutes } from "@/lib/erp/erp-operational";
import { cn } from "@/lib/utils/cn";
import type { ErpAccessId } from "@/lib/erp/erp-acesso";
import Image from "next/image";

export function ErpSidebar({ config, empresaNome, logoUrl, brandPrimary, allowedAccess }: { config: ErpSistemaConfig; empresaNome: string; logoUrl?: string | null; brandPrimary: string; allowedAccess: ErpAccessId[] }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [rotaAberta, setRotaAberta] = useState(pathname);
  // Fecha o menu do celular ao trocar de página.
  if (rotaAberta !== pathname) {
    setRotaAberta(pathname);
    setAberto(false);
  }
  const operational = listEnabledOperationalRoutes(config).filter((module) => allowedAccess.includes(module.id as ErpAccessId));
  const icons = { clientes: Users, consultores: BriefcaseBusiness, lances: TicketCheck, assembleias: Building2, "regras-comissao": Settings2, "repasse-franquia": BadgeDollarSign, "minhas-comissoes": CircleDollarSign, "contas-pagar": WalletCards, "conta-corrente-socios": Scale, robos: Bot } as const;
  return (
    <>
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 text-slate-900 md:hidden">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: brandPrimary }}>ERP Sistema</p>
        <p className="truncate text-sm font-semibold">{empresaNome}</p>
      </div>
      <button type="button" onClick={() => setAberto(true)} aria-label="Abrir menu" className="rounded-lg border border-slate-200 p-2 text-slate-700">
        <Menu className="h-5 w-5" />
      </button>
    </div>
    {aberto ? <button type="button" aria-label="Fechar menu" onClick={() => setAberto(false)} className="fixed inset-0 z-40 bg-slate-900/40 md:hidden" /> : null}
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white text-slate-900 transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:w-64 md:translate-x-0",
      aberto ? "translate-x-0 shadow-xl" : "-translate-x-full",
    )}>
      <button type="button" onClick={() => setAberto(false)} aria-label="Fechar menu" className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 md:hidden"><X className="h-5 w-5" /></button>
      <div className="border-b border-slate-200 px-5 py-5">
        {logoUrl ? <div className="relative mb-3 h-9 w-40"><Image src={logoUrl} alt={empresaNome} fill className="object-contain object-left" /></div> : null}
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: brandPrimary }}>ERP Sistema</p>
        <p className="mt-1 truncate text-sm text-slate-500">{empresaNome}</p>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Operacao</p>
          {operational.map((module) => {
            const Icon = icons[module.id as keyof typeof icons] ?? CircleDollarSign;
            const active = pathname === module.href || pathname.startsWith(`${module.href}/`);
            return <Link key={module.id} href={module.href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", active ? "text-white" : "text-slate-700 hover:bg-slate-100")} style={active ? { backgroundColor: brandPrimary } : undefined}><Icon className="h-4 w-4" />{module.label}</Link>;
          })}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Modulos base</p>
        {ERP_MODULES.filter((module) => config.modulos.includes(module.id) && allowedAccess.includes(module.id)).map((module) => {
          const active = module.href === "/erp" ? pathname === "/erp" : pathname === module.href || pathname.startsWith(`${module.href}/`);
          return <Link key={module.id} href={module.href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", active ? "text-white" : "text-slate-700 hover:bg-slate-100")} style={active ? { backgroundColor: brandPrimary } : undefined}><LayoutDashboard className="h-4 w-4" />{module.label}</Link>;
        })}
        </div>
      </nav>
      <div className="border-t border-slate-200 p-3">
        <Link href="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" />Voltar ao Portal</Link>
      </div>
    </aside>
    </>
  );
}
