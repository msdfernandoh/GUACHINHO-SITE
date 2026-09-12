"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EventoQrCheckinModal } from "./evento-qr-checkin-modal";

type EventoItem = {
  id: string;
  nome: string;
  slug: string;
  publicado: boolean;
  checkin_interativo_ativo?: boolean;
};

type Props = {
  evento: EventoItem;
  qrVinculo?: { qrId: string; qrNome: string; qrSlug: string } | null;
};

export function EventoAcoesMenu({ evento, qrVinculo = null }: Props) {
  const [aberto, setAberto] = useState(false);
  const [copiadoMsg, setCopiadoMsg] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [aberto]);

  async function copiarLink(path: string, msg: string) {
    try {
      const url = new URL(path, window.location.origin).href;
      await navigator.clipboard.writeText(url);
      setCopiadoMsg(msg);
      setTimeout(() => setCopiadoMsg(""), 2500);
      setAberto(false);
    } catch {
      setCopiadoMsg("Não foi possível copiar.");
      setTimeout(() => setCopiadoMsg(""), 2500);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* 1. Ver Check-in (Ação prioritária) */}
      <a
        href={`/eventos/${encodeURIComponent(evento.slug)}/sorteio`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 font-bold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
        title="Abrir a tela pública do check-in exatamente como o participante verá"
      >
        <span>Ver check-in</span>
        <span className="text-[10px]">↗</span>
      </a>

      {/* 2. QR Check-in (Modal completo com QR do evento e QR permanente) */}
      <EventoQrCheckinModal
        evento={{
          id: evento.id,
          nome: evento.nome,
          slug: evento.slug,
          checkinInterativoAtivo: evento.checkin_interativo_ativo,
          publicado: evento.publicado,
        }}
        qrVinculo={qrVinculo}
        label="QR Check-in"
      />

      {/* 3. Telão do Sorteio */}
      <a
        href={`/eventos/${encodeURIComponent(evento.slug)}/telao`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1.5 font-bold text-purple-700 hover:bg-purple-500/20 dark:text-purple-300"
        title="Abrir interface de telão ao vivo para palco e roleta de prêmios"
      >
        <span>Telão</span>
        <span className="text-[10px]">↗</span>
      </a>

      {/* 4. Menu Mais Opções */}
      <div ref={menuRef} className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setAberto((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-expanded={aberto}
          aria-haspopup="true"
        >
          <span>Mais</span>
          <svg
            className={`h-3 w-3 transition-transform ${aberto ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {copiadoMsg ? (
          <span className="fixed bottom-4 right-4 z-50 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xl dark:bg-white dark:text-zinc-900">
            ✓ {copiadoMsg}
          </span>
        ) : null}

        {aberto ? (
          <div className="absolute right-0 z-50 mt-1.5 w-56 origin-top-right rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-900">
            <Link
              href={`/admin/eventos/${evento.id}`}
              onClick={() => setAberto(false)}
              className="flex items-center px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span className="font-semibold">Editar evento</span>
            </Link>

            <Link
              href={`/admin/eventos/${evento.id}/participantes`}
              onClick={() => setAberto(false)}
              className="flex items-center px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span>Participantes & Presença</span>
            </Link>

            <Link
              href={`/admin/eventos/${evento.id}/sorteio#nps-config`}
              onClick={() => setAberto(false)}
              className="flex items-center px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span>Configurar Sorteio & NPS</span>
            </Link>

            <Link
              href={`/admin/eventos/nps?evento_id=${evento.id}`}
              onClick={() => setAberto(false)}
              className="flex items-center px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span>Gráficos & Respostas NPS</span>
            </Link>

            <Link
              href={`/admin/eventos/listas-convidados?evento_id=${evento.id}`}
              onClick={() => setAberto(false)}
              className="flex items-center px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span>Listas de Convidados</span>
            </Link>

            <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

            {evento.publicado ? (
              <a
                href={`/eventos/${encodeURIComponent(evento.slug)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAberto(false)}
                className="flex items-center justify-between px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <span>Ver página do evento (vitrine)</span>
                <span className="text-[10px]">↗</span>
              </a>
            ) : null}

            <button
              type="button"
              onClick={() =>
                copiarLink(
                  `/eventos/${encodeURIComponent(evento.slug)}/sorteio`,
                  "Link do Check-in copiado!",
                )
              }
              className="flex w-full items-center px-3 py-2 text-left text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Copiar link do check-in
            </button>

            <button
              type="button"
              onClick={() =>
                copiarLink(
                  `/eventos/${encodeURIComponent(evento.slug)}`,
                  "Link da página do evento copiado!",
                )
              }
              className="flex w-full items-center px-3 py-2 text-left text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Copiar link do convite
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
