"use client";

import { Button } from "@/components/ui/form-primitives";
import { formatGoogleSyncUserMessage } from "@/lib/google-calendar/sync-messages";
import type { GoogleCalendarSyncReason } from "@/lib/google-calendar/types";
import { formatDate } from "@/lib/utils/format";

const OAUTH_START = "/api/auth/google-calendar/start";

type Props = {
  status: {
    configured: boolean;
    eligible: boolean;
    syncEnabled: boolean;
    connected: boolean;
    googleEmail?: string | null;
    connectedAt?: string | null;
    requiresReconnect?: boolean;
    oauthRedirectUri?: string;
    hasClientId?: boolean;
    hasClientSecret?: boolean;
  };
  flash?: string | null;
  syncFlash?: string | null;
  syncNome?: string | null;
};

const FLASH: Record<string, string> = {
  connected: "Google Agenda conectado com sucesso.",
  disconnected: "Conexão com Google Agenda removida.",
  denied: "Autorização cancelada no Google.",
  not_gmail: "Sincronização disponível apenas para e-mails @gmail.com.",
  disabled: "Peça ao Master para habilitar a sincronização com Google Agenda no seu usuário.",
  not_configured: "Integração Google não configurada no servidor (variáveis de ambiente).",
  invalid_state: "Não foi possível validar a conexão. Tente novamente.",
  session_mismatch: "Sessão não corresponde ao usuário que iniciou a conexão. Faça login novamente e tente conectar.",
  error: "Erro ao conectar Google Agenda. Tente novamente.",
};

function ConnectGoogleButton({ label, fullWidth }: { label?: string; fullWidth?: boolean }) {
  return (
    <a href={OAUTH_START} className={fullWidth ? "block w-full" : "inline-block"}>
      <Button type="button" size="sm" variant="gold" className={fullWidth ? "w-full min-h-11 text-base" : undefined}>
        {label ?? "Conectar Google Agenda"}
      </Button>
    </a>
  );
}

function GoogleCalendarSetupHelp({
  oauthRedirectUri,
  hasClientId,
  hasClientSecret,
}: {
  oauthRedirectUri: string;
  hasClientId?: boolean;
  hasClientSecret?: boolean;
}) {
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-amber-500/30 bg-black/20 p-3 text-xs text-amber-100/90">
      <p className="font-semibold text-amber-50">Como configurar (Master / hospedagem)</p>
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>
          No <strong>Google Cloud Console</strong>, crie credenciais OAuth tipo <strong>Aplicativo da Web</strong> e
          ative a API Google Calendar.
        </li>
        <li>
          Em <strong>URIs de redirecionamento autorizados</strong>, cadastre exatamente:
          <code className="mt-1 block break-all rounded bg-black/40 px-2 py-1 text-[11px] text-amber-200">
            {oauthRedirectUri}
          </code>
        </li>
        <li>
          Na <strong>Vercel</strong> (ou .env.local), adicione variáveis de <strong>servidor</strong> (não marque
          &quot;Expose to Browser&quot;):
          <ul className="mt-1 list-disc pl-4">
            <li>
              <code>GOOGLE_CALENDAR_CLIENT_ID</code>
              {hasClientId === false ? " — ausente agora" : hasClientId ? " — detectada" : ""}
            </li>
            <li>
              <code>GOOGLE_CALENDAR_CLIENT_SECRET</code>
              {hasClientSecret === false ? " — ausente agora" : hasClientSecret ? " — detectada" : ""}
            </li>
          </ul>
        </li>
        <li>
          Confirme <code>NEXT_PUBLIC_SITE_URL</code> igual ao domínio do site (ex.:{" "}
          https://www.gauchinhoconsorcios.com.br).
        </li>
        <li>Faça um <strong>Redeploy</strong> na Vercel após salvar as variáveis.</li>
      </ol>
    </div>
  );
}

function syncFlashMessage(syncFlash: string, syncNome?: string | null): string | null {
  if (syncFlash === "synced") {
    return formatGoogleSyncUserMessage("synced", syncNome ?? "Consultor", true) ?? null;
  }
  const reason = syncFlash as GoogleCalendarSyncReason;
  return formatGoogleSyncUserMessage(reason, syncNome ?? "Consultor", false) ?? null;
}

export function GoogleCalendarAgendaBanner({ status, flash, syncFlash, syncNome }: Props) {
  const flashMsg = flash ? FLASH[flash] : null;
  const syncMsg = syncFlash ? syncFlashMessage(syncFlash, syncNome) : null;
  const redirectUri = status.oauthRedirectUri ?? "https://SEU-DOMINIO/api/auth/google-calendar/callback";

  if (!status.syncEnabled && !flashMsg && !syncMsg) return null;

  if (!status.configured) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <p className="font-medium text-amber-50">Google Agenda não está configurado no servidor</p>
        <p className="mt-1">
          {flashMsg ??
            "Faltam GOOGLE_CALENDAR_CLIENT_ID e GOOGLE_CALENDAR_CLIENT_SECRET na hospedagem (Vercel → Settings → Environment Variables)."}
        </p>
        <GoogleCalendarSetupHelp
          oauthRedirectUri={redirectUri}
          hasClientId={status.hasClientId}
          hasClientSecret={status.hasClientSecret}
        />
      </div>
    );
  }

  if (!status.syncEnabled) {
    return flashMsg || syncMsg ? (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {flashMsg ? <p>{flashMsg}</p> : null}
        {syncMsg ? <p className={flashMsg ? "mt-2" : ""}>{syncMsg}</p> : null}
      </div>
    ) : null;
  }

  if (!status.eligible) {
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm">
        {flashMsg ? <p className="mb-2 text-amber-300">{flashMsg}</p> : null}
        {syncMsg ? <p className="mb-2 text-amber-300">{syncMsg}</p> : null}
        <p className="font-medium text-zinc-100">Google Agenda</p>
        <p className="mt-1 text-zinc-400">
          Sincronização habilitada no seu usuário, mas o login precisa ser um e-mail @gmail.com. Peça ao Master
          para ajustar o e-mail em Usuários.
        </p>
      </div>
    );
  }

  const connectedAccount = status.googleEmail?.trim();
  const connectedAtLabel = status.connectedAt ? formatDate(status.connectedAt) : null;
  const needsConnect = !status.connected || status.requiresReconnect;
  const expired = Boolean(status.requiresReconnect && status.connected);

  return (
    <>
      {syncMsg ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            syncFlash === "synced"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
              : "border-amber-500/40 bg-amber-500/10 text-amber-100"
          }`}
        >
          {syncMsg}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm">
        {flashMsg ? <p className="mb-2 text-amber-300">{flashMsg}</p> : null}
        <p className="font-medium text-zinc-100">Google Agenda</p>
        <p className="mt-1 text-xs text-zinc-500">
          Sincronização {status.syncEnabled ? "habilitada" : "desabilitada"} pelo Master
        </p>

        {expired ? (
          <p className="mt-2 text-amber-300">Autorização expirada ou revogada. Reconecte sua conta Google.</p>
        ) : null}

        {status.connected && !status.requiresReconnect ? (
          <div className="mt-2 space-y-2">
            <p className="text-emerald-400">
              Google Agenda conectada
              {connectedAccount ? `: ${connectedAccount}` : ""}
              {connectedAtLabel ? ` — desde ${connectedAtLabel}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ConnectGoogleButton label="Reconectar" />
              <form action="/api/auth/google-calendar/disconnect" method="post">
                <Button type="submit" size="sm" variant="outline">
                  Desconectar
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-zinc-400">
              {needsConnect
                ? "Conecte sua conta Google para receber compromissos em que você for o consultor responsável."
                : null}
            </p>
            <div className="mt-2 hidden sm:block">
              <ConnectGoogleButton />
            </div>
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
