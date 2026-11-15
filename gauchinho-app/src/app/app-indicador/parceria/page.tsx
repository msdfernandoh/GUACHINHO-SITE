import { obterPerfilAcessoApp } from "@/lib/app-indicador/perfil-acesso";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";
import { AppIndicadorTheme } from "@/components/app-indicador/app-indicador-theme";
import { aceitarTermoAction } from "./actions";
export default async function Page(){
 const {empresaAtiva,usuario}=await getCurrentTenantContext();if(!empresaAtiva||!usuario)redirect("/app-indicador/login");
 if(await obterPerfilAcessoApp(empresaAtiva.id,usuario.id)==="PRODUCAO")redirect("/app-indicador");const {indicador,participante}=await resolveIndicadorAppSession(empresaAtiva.id,usuario.id);if(!indicador||!participante)redirect("/app-indicador");
 const db=createAdminClient();const {data:empresa}=await db.from("empresas").select("configuracoes").eq("id",empresaAtiva.id).single();const termo=empresa?.configuracoes?.termo_parceria;
 const {data:cadastro}=await db.from("programa_indicadores").select("chave_pix").eq("empresa_id",empresaAtiva.id).eq("id",indicador.id).single();
 const {data:aceites}=termo?.versao?await db.from("participante_auditoria").select("created_at").eq("empresa_id",empresaAtiva.id).eq("participante_id",participante.id).contains("payload",{tipo:"ACEITE_TERMO_PARCERIA",versao:termo.versao}).order("created_at",{ascending:false}).limit(1):{data:[]};
 const tenant=await getResolvedTenant();return <AppIndicadorTheme racon={isRaconModel(tenant?.siteModel)}><main className="min-h-screen space-y-5 bg-zinc-950 p-5 text-white"><Link href="/app-indicador">← Meu negócio</Link><h1 className="text-2xl font-bold">Recebimento e parceria</h1><section className="rounded-xl bg-zinc-900 p-5"><h2 className="font-bold">Forma de recebimento</h2><p>PIX: {cadastro?.chave_pix??"Não informado"}</p><p className="mt-3">Gerador de Possibilidades: 4 parcelas iguais. Gerador de Negócios: 8 parcelas iguais. Microfranqueado: 50% em cada etapa da tabela da franquia. Desconto de 17,5% de impostos.</p><p>Pagamento no dia 20 após o pagamento da primeira parcela do cliente, respeitando as etapas e a confirmação de recebimento.</p><Link href="/app-indicador/simulacao" className="mt-3 inline-block font-bold underline">Ver meu plano e simular valores</Link></section><section className="rounded-xl bg-zinc-900 p-5"><h2 className="text-xl font-bold">Termo de parceria</h2>{termo?.texto?<><div className="my-4 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border p-4">{termo.texto}</div>{aceites?.length?<p>Você aceitou esta versão em {new Date(aceites[0].created_at).toLocaleString("pt-BR",{timeZone:"America/Cuiaba"})}.</p>:<form action={aceitarTermoAction} className="space-y-4"><input type="hidden" name="versao" value={termo.versao}/><label className="flex gap-2"><input required type="checkbox" name="aceito" value="sim"/>Li e aceito o termo de parceria</label><button className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-zinc-950">Registrar aceite</button></form>}</>:<p>O termo de parceria ainda não foi disponibilizado pela equipe.</p>}</section></main></AppIndicadorTheme>;
}
