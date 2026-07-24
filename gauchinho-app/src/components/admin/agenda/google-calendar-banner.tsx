"use client";

import Link from "next/link";
import { Button } from "@/components/ui/form-primitives";

type Props = {
  status: {
    configured: boolean;
    eligible: boolean;
    syncEnabled: boolean;
    connected: boolean;
  };
  flash?: string | null;
};

const FLASH: Record<string, string> = {
  connected: "Google Agenda conectado com sucesso.",
  disconnected: "Conexão com Google Agenda removida.",
  denied: "Autorização cancelada no Google.",
  not_gmail: "Sincronização disponível apenas para e-mails @gmail.com.",
  disabled: "Peça ao Master para habilitar a sincronização com Google Agenda no seu usuário.",
  not_configured: "Integração Google não configurada no servidor (variáveis de ambiente).",
  invalid_state: "Não foi possível validar a conexão. Tente novamente.",
  error: "Erro ao conectar Google Agenda. Tente novamente.",
};

export function GoogleCalendarAgendaBanner({ status, flash }: Props) {
  const flashMsg = flash ? FLASH[flash] : null;

  if (!status.configured) {
    return flashMsg ? (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {flashMsg}
      </div>
    ) : null;
  }

  if (!status.eligible) return null;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm">
      {flashMsg ? <p className="mb-2 text-amber-300">{flashMsg}</p> : null}
      <p className="font-medium text-zinc-100">Google Agenda</p>
      {!status.syncEnabled ? (
        <p className="mt-1 text-zinc-400">
          Sincronização não habilitada para sua conta. O Master pode ativar em Admin → Usuários.
        </p>
      ) : status.connected ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-emerald-400">Conectado — novos compromissos serão enviados ao seu Google Agenda.</span>
          <form action="/api/auth/google-calendar/disconnect" method="post">
            <Button type="submit" size="sm" variant="outline">
              Desconectar
            </Button>
          </form>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-zinc-400">Conecte sua conta Google para receber os compromissos agendados aqui.</span>
          <Link href="/api/auth/google-calendar/start">
            <Button type="button" size="sm" variant="gold">
              Conectar Google Agenda
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
