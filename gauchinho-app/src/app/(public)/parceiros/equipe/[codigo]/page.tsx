import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { microfranquiaPorConvite } from "@/lib/microfranquia/access";
import { CadastroColaboradorForm } from "@/app/app-indicador/equipe/cadastro-form";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{codigo:string}>}){const {codigo}=await params;const tenant=await getResolvedTenant();if(!tenant)notFound();const micro=await microfranquiaPorConvite(tenant.empresaId,codigo);if(!micro)notFound();return <main className="mx-auto max-w-3xl space-y-5 px-5 py-12"><p className="text-sm font-bold text-blue-700">PROGRAMA DE PARCEIROS</p><h1 className="text-3xl font-black text-slate-900">Equipe de {micro.nome}</h1><p className="text-slate-600">Seu cadastro ficará vinculado a esta microfranquia.</p><CadastroColaboradorForm codigo={codigo}/></main>}
