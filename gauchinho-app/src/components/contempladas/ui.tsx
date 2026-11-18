"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Shell({ children, titulo, sub }: { children: React.ReactNode; titulo: string; sub?: string }) {
  return (
    <div className="min-h-dvh bg-[#07142b] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07142b]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="/contempladas" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 font-black text-[#07142b]">C</span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">{titulo}</span>
              {sub && <span className="block text-[11px] text-white/60">{sub}</span>}
            </span>
          </a>
          <nav className="flex gap-1 text-xs">
            <a className="rounded-lg px-2.5 py-1.5 hover:bg-white/10" href="/contempladas">Simular</a>
            <a className="rounded-lg px-2.5 py-1.5 hover:bg-white/10" href="/contempladas/painel">Painel</a>
            <a className="rounded-lg bg-amber-400 px-2.5 py-1.5 font-semibold text-[#07142b]" href="/contempladas/importar">Enviar cotas</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-32 pt-5">{children}</main>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${className}`}>{children}</div>;
}

export const inputCls =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/40 outline-none focus:border-amber-400";

export const btnOuro =
  "rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-4 py-3 font-bold text-[#07142b] shadow-lg shadow-amber-500/20 disabled:opacity-50";
export const btnSec = "rounded-xl border border-white/20 px-4 py-3 font-semibold hover:bg-white/10 disabled:opacity-50";

/** Login com usuário do ERP (Supabase Auth). */
export function LoginBox({ motivo }: { motivo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  return (
    <Card className="mx-auto max-w-sm">
      <h2 className="text-lg font-bold">Entrar</h2>
      <p className="mb-4 text-sm text-white/60">{motivo}</p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setCarregando(true);
          setErro(null);
          const { error } = await createClient().auth.signInWithPassword({ email, password: senha });
          setCarregando(false);
          if (error) setErro("E-mail ou senha inválidos.");
          else router.refresh();
        }}
      >
        <input className={inputCls} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={inputCls} type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        {erro && <p className="text-sm text-red-300">{erro}</p>}
        <button className={`${btnOuro} w-full`} disabled={carregando}>{carregando ? "Entrando…" : "Entrar"}</button>
      </form>
    </Card>
  );
}

export function Sair() {
  const router = useRouter();
  return (
    <button
      className="text-xs text-white/60 underline"
      onClick={async () => {
        await createClient().auth.signOut();
        router.refresh();
      }}
    >
      sair
    </button>
  );
}
