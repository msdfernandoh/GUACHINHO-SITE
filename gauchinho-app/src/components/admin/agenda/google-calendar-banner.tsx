"use client";

import { Button } from "@/components/ui/form-primitives";

const OAUTH_START = "/api/auth/google-calendar/start";

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

function ConnectGoogleButton({ fullWidth }: { fullWidth?: boolean }) {
  return (
    <a href={OAUTH_START} className={fullWidth ? "block w-full" : "inline-block"}>
      <Button type="button" size="sm" variant="gold" className={fullWidth ? "w-full min-h-11 text-base" : undefined}>
        Sincronizar Google Agenda
      </Button>
    </a>
  );
}

export function GoogleCalendarAgendaBanner({ status, flash }: Props) {
  const flashMsg = flash ? FLASH[flash] : null;

  if (!status.syncEnabled && !flashMsg) return null;

  if (!status.configured) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {flashMsg ?? "Google Agenda não está configurado no servidor (CLIENT_ID / CLIENT_SECRET)."}
      </div>
    );
  }

  if (!status.syncEnabled) {
    return flashMsg ? (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {flashMsg}
      </div>
    ) : null;
  }

  if (!status.eligible) {
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm">
        {flashMsg ? <p className="mb-2 text-amber-300">{flashMsg}</p> : null}
        <p className="font-medium text-zinc-100">Google Agenda</p>
        <p className="mt-1 text-zinc-400">
          Sincronização habilitada no seu usuário, mas o login precisa ser um e-mail @gmail.com. Peça ao Master
          para ajustar o e-mail em Usuários.
        </p>
      </div>
    );
  }

  const needsConnect = !status.connected;

  return (
    <>
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm">
        {flashMsg ? <p className="mb-2 text-amber-300">{flashMsg}</p> : null}
        <p className="font-medium text-zinc-100">Google Agenda</p>
        {status.connected ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-emerald-400">
              Conectado — novos compromissos serão enviados ao seu Google Agenda.
            </span>
            <form action="/api/auth/google-calendar/disconnect" method="post">
              <Button type="submit" size="sm" variant="outline">
                Desconectar
              </Button>
            </form>
          </div>
        ) : (
          <div className="mt-2 hidden flex-wrap items-center gap-2 sm:flex">
            <span className="text-zinc-400">
              Toque em sincronizar para autorizar o Google Calendar neste dispositivo.
            </span>
            <ConnectGoogleButton />
          </div>
        )}
      </div>

      {needsConnect ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-700 bg-zinc-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg sm:hidden">
          <p className="mb-2 text-center text-xs text-zinc-400">
            Autorize o Google para receber compromissos no celular
          </p>
          <ConnectGoogleButton fullWidth />
        </div>
      ) : null}
    </>
  );
}
