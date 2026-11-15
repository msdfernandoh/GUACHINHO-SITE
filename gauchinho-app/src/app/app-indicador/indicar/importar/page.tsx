import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";
import { ImportarPlanilha } from "./importar-planilha";
export default async function Page(){const {empresaAtiva,usuario}=await getCurrentTenantContext();if(!empresaAtiva||!usuario)redirect("/app-indicador/login");const {indicador}=await resolveIndicadorAppSession(empresaAtiva.id,usuario.id);if(!indicador)redirect("/app-indicador");return <main className="min-h-screen bg-slate-50 p-5 text-slate-900"><div className="mx-auto max-w-6xl space-y-6"><Link href="/app-indicador/indicar" className="font-bold text-blue-700">← Nova indicação</Link><h1 className="text-3xl font-black">Importar indicações por planilha</h1><ImportarPlanilha/></div></main>}
