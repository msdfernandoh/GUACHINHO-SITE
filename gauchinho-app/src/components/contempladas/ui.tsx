"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const AZUL = "#0047bb";

export function Shell({ children, titulo, sub, papel = null }: { children: React.ReactNode; titulo: string; sub?: string; papel?: string | null }) {
  return (
    <div className="contempladas-ui min-h-dvh bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <a href="/contempladas" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0047bb] text-lg font-black text-white">R</span>
            <span className="leading-tight">
              <span className="block text-base font-extrabold text-[#0a2a66]">{titulo}</span>
              {sub && <span className="block text-xs text-slate-500">{sub}</span>}
            </span>
          </a>
          <nav className="flex gap-1 text-sm font-semibold">
            <a className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/contempladas">Cotas</a>
            <a className="hidden rounded-lg px-3 py-2 text-[#0047bb] hover:bg-slate-100 sm:inline" href="/contempladas/seja-parceiro" target="_blank" rel="noreferrer">Seja parceiro ↗</a>
            {papel && <a className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/contempladas/painel">Painel</a>}
            {(papel === "DONO" || papel === "GERENTE") && (
              <a className="rounded-lg bg-[#0047bb] px-3 py-2 text-white hover:bg-[#003a99]" href="/contempladas/importar">Enviar cotas</a>
            )}
            {!papel && <a className="rounded-lg border border-[#0047bb] px-3 py-2 text-[#0047bb]" href="/contempladas/painel">Área do parceiro</a>}
            {papel && <Sair destaque />}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 pb-32 pt-6 sm:px-8">{children}</main>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0047bb] focus:ring-2 focus:ring-[#0047bb]/15";

export const btnOuro =
  "rounded-xl bg-[#0047bb] px-4 py-3 font-bold text-white shadow-sm hover:bg-[#003a99] disabled:opacity-50";
export const btnSec = "rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50";

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
      <p className="mb-4 text-sm text-slate-500">{motivo}</p>
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
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className={`${btnOuro} w-full`} disabled={carregando}>{carregando ? "Entrando…" : "Entrar"}</button>
      </form>
    </Card>
  );
}

export function Sair({ destaque = false }: { destaque?: boolean }) {
  const router = useRouter();
  return (
    <button
      className={destaque ? "rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" : "text-xs text-slate-500 underline"}
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/contempladas");
        router.refresh();
      }}
    >
      {destaque ? "Sair" : "sair"}
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

/** Máscara de dinheiro: digita só números e vira 3.000.000,00 (centavos à direita). */
export function mascaraReais(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!d) return "";
  const n = Number(d) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export const reaisParaNumero = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
export const numeroParaReais = (n: number) => (n ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

/** Campo de valor com "R$" fixo e máscara 0.000,00. */
export function MoneyInput({ value, onChange, placeholder = "0,00", className = "" }: { value: number; onChange: (v: number) => void; placeholder?: string; className?: string }) {
  const [txt, setTxt] = useState(numeroParaReais(value));
  // Valor mudou por fora (ex.: limpar): reflete no campo. Compara em centavos para não entrar em laço.
  const alvo = Math.round((value || 0) * 100);
  if (Math.round(reaisParaNumero(txt) * 100) !== alvo) setTxt(numeroParaReais(alvo / 100));
  return (
    <div className={`flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-[#0047bb] focus-within:ring-2 focus-within:ring-[#0047bb]/15 ${className}`}>
      <span className="pl-3 text-sm font-semibold text-slate-500">R$</span>
      <input className="w-full rounded-xl bg-transparent px-2 py-2.5 text-right text-base text-slate-900 outline-none placeholder:text-slate-400" inputMode="numeric" placeholder={placeholder}
        value={txt} onChange={(e) => { const m = mascaraReais(e.target.value); setTxt(m); onChange(reaisParaNumero(m)); }} />
    </div>
  );
}
