import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentTenantContext } from "@/lib/tenant/context";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";
import { AppIndicadorTheme } from "@/components/app-indicador/app-indicador-theme";
import { CalculadoraComissao } from "./calculadora";
import type { ModeloParceiroId } from "@/lib/parceiros/modelos-programa";
export default async function Page(){const {empresaAtiva,usuario}=await requireCurrentTenantContext();const {indicador}=await resolveIndicadorAppSession(empresaAtiva.id,usuario.id);if(!indicador)redirect("/app-indicador");const aprovado=indicador.status_solicitacao_modelo==="APROVADO";const solicitado=indicador.modelo_interesse;const modelo:ModeloParceiroId=aprovado&&(solicitado==="MICROFRANQUEADO"||solicitado==="GERADOR_NEGOCIOS")?solicitado:"GERADOR_POSSIBILIDADES";const tenant=await getResolvedTenant();return <AppIndicadorTheme racon={isRaconModel(tenant?.siteModel)}><main className="min-h-screen bg-zinc-950 p-5 text-white"><Link href="/app-indicador">← Meu negócio</Link><CalculadoraComissao modelo={modelo}/>{!aprovado&&<p className="mt-4">Simulação no nível de entrada. Solicitar outro modelo não altera o percentual antes da aprovação.</p>}</main></AppIndicadorTheme>}
