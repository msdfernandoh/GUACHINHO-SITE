"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Shell({ children, titulo, sub, papel = null }: { children: React.ReactNode; titulo: string; sub?: string; papel?: string | null }) {
  return (
    <div className="contempladas-ui min-h-dvh bg-[#07142b] text-white [color-scheme:dark]">
      <style>{`.contempladas-ui select option{background:#0b1d3d;color:#fff}.contempladas-ui select option:checked{background:#f59e0b;color:#07142b}`}</style>
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
            {papel && <a className="rounded-lg px-2.5 py-1.5 hover:bg-white/10" href="/contempladas/painel">Painel</a>}
            {(papel === "DONO" || papel === "GERENTE") && (
              <a className="rounded-lg bg-amber-400 px-2.5 py-1.5 font-semibold text-[#07142b]" href="/contempladas/importar">Enviar cotas</a>
            )}
            {!papel && <a className="rounded-lg px-2.5 py-1.5 hover:bg-white/10" href="/contempladas/painel">Entrar</a>}
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

/* ------------------------------ Máscaras ------------------------------ */

export function mascaraTelefone(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Campo de celular com máscara (xx) xxxxx-xxxx. Funciona controlado ou com `name` em formulário. */
export function TelInput({ value, onChange, name, placeholder = "(66) 99999-9999", required }: { value?: string; onChange?: (v: string) => void; name?: string; placeholder?: string; required?: boolean }) {
  const [interno, setInterno] = useState("");
  const v = mascaraTelefone(value ?? interno);
  return (
    <input className={inputCls} type="tel" inputMode="tel" autoComplete="tel" name={name} placeholder={placeholder} required={required} pattern="\(\d{2}\) \d{4,5}-\d{4}" title="Celular com DDD"
      value={v} onChange={(e) => { const m = mascaraTelefone(e.target.value); if (onChange) onChange(m); else setInterno(m); }} />
  );
}

export type TipoPix = "CELULAR" | "EMAIL" | "CPF" | "CNPJ" | "ALEATORIA";
export const TIPOS_PIX: [TipoPix, string][] = [["CELULAR", "Celular"], ["CPF", "CPF"], ["CNPJ", "CNPJ"], ["EMAIL", "E-mail"], ["ALEATORIA", "Chave aleatória"]];

export function mascaraPix(tipo: TipoPix, raw: string) {
  const d = raw.replace(/\D/g, "");
  if (tipo === "CELULAR") return mascaraTelefone(raw);
  if (tipo === "CPF") {
    const x = d.slice(0, 11);
    return x.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  if (tipo === "CNPJ") {
    const x = d.slice(0, 14);
    return x.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
  if (tipo === "ALEATORIA") return raw.toLowerCase().replace(/[^0-9a-f-]/g, "").slice(0, 36);
  return raw.trim().toLowerCase();
}

export function PixInput({ tipo, valor, onChange }: { tipo: TipoPix; valor: string; onChange: (tipo: TipoPix, valor: string) => void }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2">
      <select className={`${inputCls} !w-40`} value={tipo} onChange={(e) => onChange(e.target.value as TipoPix, "")}>
        {TIPOS_PIX.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input className={inputCls} value={valor} inputMode={tipo === "CPF" || tipo === "CNPJ" || tipo === "CELULAR" ? "numeric" : tipo === "EMAIL" ? "email" : "text"}
        placeholder={{ CELULAR: "(66) 99999-9999", CPF: "000.000.000-00", CNPJ: "00.000.000/0000-00", EMAIL: "nome@email.com", ALEATORIA: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }[tipo]}
        onChange={(e) => onChange(tipo, mascaraPix(tipo, e.target.value))} />
    </div>
  );
}
