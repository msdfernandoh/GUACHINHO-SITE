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
    const ua = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua));
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function instalar() {
    if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null); return; }
    setInstrucoes(true);
  }

  return <div className="relative inline-flex flex-col items-center gap-3"><Link href="/app-indicador/login" className={`inline-flex items-center gap-2 rounded-2xl px-6 py-4 font-black shadow-lg transition hover:scale-[1.02] ${dark ? "bg-amber-500 text-zinc-950" : "bg-zinc-950 text-white"}`}><Smartphone className="h-5 w-5" />Abrir meu app no celular</Link><button type="button" onClick={instalar} className={`inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4 ${dark ? "text-zinc-200" : "text-zinc-700"}`}><Download className="h-4 w-4" />Instalar na tela inicial</button><span className={`inline-flex items-center gap-1 text-xs ${dark ? "text-zinc-300" : "text-zinc-600"}`}>Controle seus indicados e comissões pelo celular</span>{instrucoes ? <div className="absolute top-full z-20 mt-2 w-72 rounded-2xl border border-zinc-200 bg-white p-4 text-left text-sm text-zinc-800 shadow-xl"><b>Instale em poucos segundos</b><p className="mt-2">{isIos ? "No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”." : "No menu do navegador, escolha “Instalar app” ou “Adicionar à tela inicial”."}</p><button type="button" onClick={() => setInstrucoes(false)} className="mt-3 text-xs font-bold text-amber-700">Entendi</button></div> : null}</div>;
}
