"use client";

import { Download, Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

export function InstalarAppIndicadorCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [mostrarInstrucao, setMostrarInstrucao] = useState(false);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setIsIos(/iPad|iPhone|iPod/.test(window.navigator.userAgent));
    });
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  async function instalar() {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
      return;
    }
    setMostrarInstrucao(true);
  }

  return (
    <section className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
      <div className="flex gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <h2 className="font-black">Instale este painel no celular</h2>
          {isIos ? (
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">
              No iPhone, toque em <Share className="mx-0.5 inline h-4 w-4" aria-label="Compartilhar" /> Compartilhar e escolha <b>Adicionar à Tela de Início</b>.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">
              Crie um ícone para abrir diretamente suas indicações e comissões.
            </p>
          )}
          {!isIos ? (
            <>
              <button
                type="button"
                onClick={instalar}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-zinc-950"
              >
                <Download className="h-4 w-4" />{installPrompt ? "Instalar app" : "Ver como instalar"}
              </button>
              {mostrarInstrucao ? <p className="mt-3 text-sm leading-relaxed text-zinc-300">No menu do navegador, escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p> : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
