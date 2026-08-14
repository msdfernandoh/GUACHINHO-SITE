"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BadgeDollarSign, BriefcaseBusiness, Building2, CircleDollarSign, LayoutDashboard, Settings2, TicketCheck, Users, WalletCards } from "lucide-react";
import { ERP_MODULES, type ErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { listEnabledOperationalRoutes } from "@/lib/erp/erp-operational";
import { cn } from "@/lib/utils/cn";

export function ErpSidebar({ config, empresaNome }: { config: ErpSistemaConfig; empresaNome: string }) {
  const pathname = usePathname();
  const operational = listEnabledOperationalRoutes(config);
  const icons = { clientes: Users, consultores: BriefcaseBusiness, lances: TicketCheck, assembleias: Building2, "regras-comissao": Settings2, "repasse-franquia": BadgeDollarSign, "minhas-comissoes": CircleDollarSign, "contas-pagar": WalletCards } as const;
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white text-slate-900">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">ERP Sistema</p>
        <p className="mt-1 truncate text-sm text-slate-500">{empresaNome}</p>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Operacao</p>
          {operational.map((module) => {
            const Icon = icons[module.id as keyof typeof icons] ?? CircleDollarSign;
            const active = pathname === module.href || pathname.startsWith(`${module.href}/`);
            return <Link key={module.id} href={module.href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100")}><Icon className="h-4 w-4" />{module.label}</Link>;
          })}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Modulos base</p>
        {ERP_MODULES.filter((module) => config.modulos.includes(module.id)).map((module) => {
          const active = module.href === "/erp" ? pathname === "/erp" : pathname === module.href || pathname.startsWith(`${module.href}/`);
          return <Link key={module.id} href={module.href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100")}><LayoutDashboard className="h-4 w-4" />{module.label}</Link>;
        })}
        </div>
      </nav>
      <div className="border-t border-slate-200 p-3">
        <Link href="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" />Voltar ao Portal</Link>
      </div>
    </aside>
  );
}
