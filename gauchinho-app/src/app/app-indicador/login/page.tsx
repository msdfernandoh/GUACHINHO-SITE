import Link from "next/link";
import { loginIndicadorAction } from "./actions";
import { CpfLoginInput } from "./cpf-login-input";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";
import { AppIndicadorTheme } from "@/components/app-indicador/app-indicador-theme";

export default async function LoginIndicador({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const tenant = await getResolvedTenant();
  const racon = isRaconModel(tenant?.siteModel);
  return <AppIndicadorTheme racon={racon}><main className="min-h-screen bg-zinc-950 px-5 py-16 text-white"><form action={loginIndicadorAction} className="mx-auto max-w-sm rounded-3xl bg-white p-6 text-zinc-900"><p className="font-bold text-amber-700">{racon ? `${tenant?.branding.nome_site || "Racon Sinop"} PARCEIROS` : "GAUCHINHO PARCEIROS"}</p><h1 className="mt-2 text-3xl font-black">Seu app de indicações</h1><p className="mt-2 text-sm text-zinc-600">Entre com seu CPF e senha para acompanhar indicações e comissões.</p><p className="mt-2 text-xs font-semibold text-amber-700">Para um novo acesso, a senha inicial são os últimos 6 dígitos do CPF.</p>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<CpfLoginInput /><input name="senha" type="password" autoComplete="current-password" required placeholder="Senha" className="mt-3 w-full rounded-2xl border p-4"/><button className="mt-4 w-full rounded-2xl bg-zinc-950 p-4 font-bold text-white">Entrar</button><Link href="/app-indicador/recuperar-senha" className="mt-4 block text-center text-sm font-bold text-amber-700 underline">Esqueci minha senha</Link><Link href="/parceiros/cadastro" className="mt-3 block text-center text-sm underline">Quero me cadastrar</Link></form></main></AppIndicadorTheme>;
}
