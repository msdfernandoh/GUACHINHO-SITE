import { AppIndicadorTheme } from "@/components/app-indicador/app-indicador-theme";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";
import Link from "next/link";
import { headers } from "next/headers";
import { requireResponsavelFixo } from "@/lib/app-indicador/responsavel-fixo";
import { gerarConviteFixo } from "@/lib/app-indicador/convite-fixo";
import { listarEquipe } from "@/lib/microfranquia/resultados";
import { IndicadorLinkCard } from "@/components/app-indicador/indicador-link-card";
export default async function Page(){
 const {empresaId,responsavel}=await requireResponsavelFixo();
 const equipe=await listarEquipe(empresaId,responsavel.id,{somenteProducao:true});
 const h=await headers();const host=(h.get("x-forwarded-host")??h.get("host")??"").split(",")[0].trim();const protocolo=(h.get("x-forwarded-proto")??"https").split(",")[0].trim();
 const link=`${protocolo}://${host}/parceiros/colaborador/${gerarConviteFixo(empresaId,responsavel.id)}`;
 const brl=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
 const tenant=await getResolvedTenant();
 return <AppIndicadorTheme racon={isRaconModel(tenant?.siteModel)}><main className="min-h-screen bg-zinc-950 p-5 text-white"><Link href="/app-indicador">← Meu negócio</Link><h1 className="mt-5 text-2xl font-black">Colaboradores fixos</h1><p className="mt-3">Envie este link para cadastrar funcionários que recebem diretamente de você. No app, eles acompanham somente suas indicações, etapas do funil e valores fechados.</p><IndicadorLinkCard url={link} titulo="Link de cadastro da equipe fixa" descricao="O cadastro por este link cria o perfil Colaborador — somente produção, sem acesso a comissões, datas de pagamento ou contrato de parceria."/><section className="mt-6 space-y-3"><h2 className="text-xl font-bold">Produção por colaborador</h2>{equipe.map(p=><article key={p.id} className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5"><b>{p.nome}</b><p>{p.status}</p><p className="mt-2">{p.indicacoes} indicações · {p.vendas} negócios fechados</p><p>Valor fechado: {brl(p.creditoVendido)}</p></article>)}{!equipe.length&&<p>Nenhum colaborador cadastrado por este link ainda.</p>}</section></main></AppIndicadorTheme>;
}
