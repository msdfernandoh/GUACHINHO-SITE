import Link from "next/link";
import { EsqueciSenhaForm } from "@/app/(auth)/esqueci-senha/esqueci-senha-form";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";
import { AppIndicadorTheme } from "@/components/app-indicador/app-indicador-theme";

export default async function RecuperarSenhaIndicadorPage() {
  const tenant = await getResolvedTenant();
  const racon = isRaconModel(tenant?.siteModel);
  return <AppIndicadorTheme racon={racon}><main className="min-h-screen bg-zinc-950 px-5 py-16 text-white"><section className="mx-auto max-w-md rounded-3xl bg-white p-7 text-zinc-900"><p className="font-black tracking-[.12em] text-amber-700">{racon ? `${tenant?.branding.nome_site || "Racon Sinop"} PARCEIROS` : "GAUCHINHO PARCEIROS"}</p><h1 className="mt-3 text-3xl font-black">Recuperar acesso ao app</h1><p className="mt-3 text-sm leading-relaxed text-zinc-600">Informe o e-mail usado no cadastro. Você receberá um link seguro para criar uma nova senha.</p><EsqueciSenhaForm isRacon={racon} primary={racon ? "#0066cc" : "#d4a017"} /><Link href="/app-indicador/login" className="mt-6 block text-center text-sm font-bold text-amber-700 underline">Voltar ao login do app</Link></section></main></AppIndicadorTheme>;
}
