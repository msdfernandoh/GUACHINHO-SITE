import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { validarConviteFixo } from "@/lib/app-indicador/convite-fixo";
import { obterResponsavelFixo } from "@/lib/app-indicador/responsavel-fixo";
import { CadastroColaboradorForm } from "@/app/app-indicador/equipe/cadastro-form";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;const tenant=await getResolvedTenant();if(!tenant)notFound();const convite=validarConviteFixo(token,tenant.empresaId);if(!convite)notFound();const responsavel=await obterResponsavelFixo(tenant.empresaId,convite.responsavelId);if(!responsavel)notFound();return <main className="mx-auto max-w-3xl space-y-5 px-5 py-12"><h1 className="text-3xl font-black text-slate-900">Equipe de {responsavel.nome}</h1><p className="text-slate-600">Cadastre-se para acompanhar suas indicações, as etapas das negociações e as vendas fechadas.</p><CadastroColaboradorForm tokenFixo={token}/></main>}
