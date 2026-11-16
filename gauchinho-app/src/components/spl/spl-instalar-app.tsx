"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

/** Botão grande para colocar o painel ou o portfólio na tela inicial do celular. */
export function SplInstalarApp({ texto = "Instale na tela inicial do celular" }: { texto?: string }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [instalado, setInstalado] = useState(false);
  const [ajuda, setAjuda] = useState(false);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setIos(/iPad|iPhone|iPod/.test(window.navigator.userAgent));
      setInstalado(window.matchMedia("(display-mode: standalone)").matches);
    });
    const antes = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const depois = () => setInstalado(true);
    window.addEventListener("beforeinstallprompt", antes);
    window.addEventListener("appinstalled", depois);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("beforeinstallprompt", antes);
      window.removeEventListener("appinstalled", depois);
    };
  }, []);

  if (instalado) return null;

  async function instalar() {
    if (prompt) {
      await prompt.prompt();
      setPrompt(null);
      return;
    }
    setAjuda(true);
  }

  return (
    <div className="rounded-3xl border-2 border-[#F59E0B]/50 bg-[#F59E0B]/10 p-4 print:hidden">
      <p className="text-lg font-black text-[#0A1931]">{texto}</p>
      <p className="text-base text-slate-700">Vira um ícone no celular que abre direto aqui, como um aplicativo.</p>
      {ios ? (
        <p className="mt-2 text-base font-semibold text-slate-800">
          No iPhone: toque em <b>Compartilhar</b> (o quadrado com a seta para cima) e depois em <b>Adicionar à Tela de Início</b>.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={instalar}
            className="mt-3 min-h-[56px] w-full rounded-2xl bg-[#F59E0B] px-5 text-lg font-extrabold text-[#3B2302]"
          >
            {prompt ? "Instalar o app" : "Como instalar"}
          </button>
          {ajuda ? (
            <p className="mt-2 text-base font-semibold text-slate-800">
              No menu do navegador (os três pontinhos), toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
