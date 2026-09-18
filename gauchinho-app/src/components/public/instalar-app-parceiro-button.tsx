"use client";

import { Download, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstalarAppParceiroButton({ dark = false }: { dark?: boolean }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [instrucoes, setInstrucoes] = useState(false);

  useEffect(() => {
    setIsIos(/iPad|iPhone|iPod/.test(window.navigator.userAgent));
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function instalar() {
    if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null); return; }
    setInstrucoes(true);
  }

  return <div className="relative inline-flex flex-col items-center gap-3">
    <button type="button" onClick={instalar} className={`inline-flex items-center gap-2 rounded-2xl px-6 py-4 font-black shadow-lg transition hover:scale-[1.02] ${dark ? "bg-amber-500 text-zinc-950" : "bg-zinc-950 text-white"}`}><Download className="h-5 w-5" />Baixar app de indicação</button>
    <Link href="/app-indicador/login" className={`inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4 ${dark ? "text-zinc-200" : "text-zinc-700"}`}><Smartphone className="h-4 w-4" />Já tenho acesso — abrir meu app</Link>
    <span className={`inline-flex items-center gap-1 text-xs ${dark ? "text-zinc-300" : "text-zinc-600"}`}><Smartphone className="h-3.5 w-3.5" />Controle seus indicados e comissões pelo celular</span>
    {instrucoes ? <div role="dialog" aria-modal="true" aria-label="Como instalar o app" className="fixed inset-0 z-[100] flex items-end justify-center bg-zinc-950/65 p-5 sm:items-center"><div className="w-full max-w-sm rounded-3xl bg-white p-6 text-left text-zinc-900 shadow-2xl"><div className="flex items-center gap-3"><span className="rounded-2xl bg-amber-100 p-3 text-amber-800"><Smartphone className="h-6 w-6" /></span><div><p className="font-black">Instale seu app de indicação</p><p className="text-xs text-zinc-500">Leva poucos segundos.</p></div></div><p className="mt-5 leading-relaxed">{isIos ? "No iPhone, toque no ícone Compartilhar do navegador e escolha “Adicionar à Tela de Início”." : "No menu do navegador, escolha “Instalar app” ou “Adicionar à tela inicial”."}</p><div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-relaxed text-blue-950"><b>O que será adicionado:</b> um ícone que abre diretamente seu painel de indicação, com indicados, situações e comissões. O site inteiro não é baixado para o celular.</div><button type="button" onClick={() => setInstrucoes(false)} className="mt-6 w-full rounded-2xl bg-zinc-950 p-4 font-black text-white">Entendi</button></div></div> : null}
  </div>;
}
