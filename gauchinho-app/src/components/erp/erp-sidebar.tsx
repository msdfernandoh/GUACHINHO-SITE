"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { ERP_MODULES, type ErpSistemaConfig } from "@/lib/erp/erp-modulos";
import { cn } from "@/lib/utils/cn";

export function ErpSidebar({ config, empresaNome }: { config: ErpSistemaConfig; empresaNome: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white text-slate-900">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">ERP Sistema</p>
        <p className="mt-1 truncate text-sm text-slate-500">{empresaNome}</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {ERP_MODULES.filter((module) => config.modulos.includes(module.id)).map((module) => {
          const active = module.href === "/erp" ? pathname === "/erp" : pathname === module.href || pathname.startsWith(`${module.href}/`);
          return <Link key={module.id} href={module.href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100")}><LayoutDashboard className="h-4 w-4" />{module.label}</Link>;
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <Link href="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" />Voltar ao Portal</Link>
      </div>
    </aside>
  );
}
