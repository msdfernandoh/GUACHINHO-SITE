import Link from "next/link";
import { AdministratorNewForm } from "@/components/platform/administrator-new-form";

export default function NovaAdministradoraPage() {
  return <div className="mx-auto max-w-4xl space-y-6">
    <header><Link href="/platform/administradoras" className="text-sm font-semibold text-cyan-700">← Administradoras</Link><p className="mt-4 text-xs font-bold uppercase tracking-widest text-cyan-600">Catálogo global</p><h1 className="mt-1 text-3xl font-bold">Nova Administradora</h1><p className="mt-2 text-slate-500">Cadastre a raiz do catálogo. Tipos, Modalidades, Curvas e Programas serão configurados no hub.</p></header>
    <AdministratorNewForm/>
  </div>;
}
