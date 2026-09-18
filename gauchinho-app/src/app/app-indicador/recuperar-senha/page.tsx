import Link from "next/link";
import { EsqueciSenhaForm } from "@/app/(auth)/esqueci-senha/esqueci-senha-form";

export default function RecuperarSenhaIndicadorPage() {
  return <main className="min-h-screen bg-zinc-950 px-5 py-16 text-white"><section className="mx-auto max-w-md rounded-3xl bg-white p-7 text-zinc-900"><p className="font-black tracking-[.12em] text-amber-700">GAUCHINHO PARCEIROS</p><h1 className="mt-3 text-3xl font-black">Recuperar acesso ao app</h1><p className="mt-3 text-sm leading-relaxed text-zinc-600">Informe o e-mail usado no cadastro. Você receberá um link seguro para criar uma nova senha.</p><EsqueciSenhaForm isRacon={false} primary="#d4a017" /><Link href="/app-indicador/login" className="mt-6 block text-center text-sm font-bold text-amber-700 underline">Voltar ao login do app</Link></section></main>;
}
