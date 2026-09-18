import Link from "next/link";
import { loginIndicadorAction } from "./actions";
import { CpfLoginInput } from "./cpf-login-input";

export default async function LoginIndicador({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="min-h-screen bg-zinc-950 px-5 py-16 text-white"><form action={loginIndicadorAction} className="mx-auto max-w-sm rounded-3xl bg-white p-6 text-zinc-900"><p className="font-bold text-amber-700">GAUCHINHO PARCEIROS</p><h1 className="mt-2 text-3xl font-black">Seu app de indicações</h1><p className="mt-2 text-sm text-zinc-600">Entre com CPF e senha para acompanhar suas indicações e comissões.</p>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<CpfLoginInput /><input name="senha" type="password" autoComplete="current-password" required placeholder="Senha" className="mt-3 w-full rounded-2xl border p-4"/><button className="mt-4 w-full rounded-2xl bg-zinc-950 p-4 font-bold text-white">Entrar</button><Link href="/app-indicador/recuperar-senha" className="mt-4 block text-center text-sm font-bold text-amber-700 underline">Esqueci minha senha</Link><Link href="/parceiros" className="mt-3 block text-center text-sm underline">Quero me cadastrar</Link></form></main>;
}
