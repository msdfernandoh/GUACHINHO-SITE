"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  Send,
  Link2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

export type MensagemView = {
  id: string;
  direcao: "enviada" | "recebida";
  contato_numero: string;
  contato_nome: string | null;
  tipo: string;
  conteudo: string | null;
  template_nome: string | null;
  status: string | null;
  criada_em: string;
};

type ConexaoView = {
  numero: string | null;
  verifiedName: string | null;
  status: string;
  coexistencia: boolean;
} | null;

type Meta = { appId: string; configId: string; graphVersion: string };

declare global {
  interface Window {
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (cb: (resp: unknown) => void, params: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function useFacebookSdk(meta: Meta) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!meta.appId) return;
    if (window.FB) {
      setReady(true);
      return;
    }
    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: meta.appId,
        cookie: true,
        autoLogAppEvents: true,
        xfbml: true,
        version: meta.graphVersion,
      });
      setReady(true);
    };
    const id = "facebook-jssdk";
    if (!document.getElementById(id)) {
      const js = document.createElement("script");
      js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      js.async = true;
      js.defer = true;
      js.crossOrigin = "anonymous";
      document.body.appendChild(js);
    }
  }, [meta.appId, meta.graphVersion]);
  return ready;
}

export default function WhatsappClient({
  conexao,
  mensagens,
  meta,
}: {
  conexao: ConexaoView;
  mensagens: MensagemView[];
  meta: Meta;
}) {
  const router = useRouter();
  const sdkReady = useFacebookSdk(meta);
  const wabaRef = useRef<string | null>(null);
  const phoneRef = useRef<string | null>(null);

  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"texto" | "template">("texto");

  // Captura waba_id/phone_number_id emitidos pelo Embedded Signup.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      )
        return;
      try {
        const data = JSON.parse(event.data);
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.data) {
          if (data.data.waba_id) wabaRef.current = data.data.waba_id;
          if (data.data.phone_number_id) phoneRef.current = data.data.phone_number_id;
        }
      } catch {
        // mensagem não-JSON — ignora
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const conectar = useCallback(() => {
    setErro(null);
    if (!window.FB) {
      setErro("SDK do Facebook ainda carregando. Tente novamente em alguns segundos.");
      return;
    }
    if (!meta.configId) {
      setErro("Configuração do app (config_id) ausente. Verifique as variáveis de ambiente.");
      return;
    }

    setConectando(true);

    try {
      // O SDK da Meta exige função síncrona como callback (rejeita AsyncFunction).
      window.FB.login(
        (resp: unknown) => {
          const r = resp as { authResponse?: { code?: string } };
          const code = r?.authResponse?.code;
          if (!code) {
            setConectando(false);
            setErro("Conexão cancelada ou sem autorização.");
            return;
          }
          void (async () => {
            try {
              const res = await fetch("/api/erp/whatsapp/conectar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  code,
                  waba_id: wabaRef.current,
                  phone_number_id: phoneRef.current,
                }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json?.error ?? "Falha ao conectar");
              router.refresh();
            } catch (e) {
              setErro(e instanceof Error ? e.message : "Falha ao conectar");
            } finally {
              setConectando(false);
            }
          })();
        },
        {
          config_id: meta.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
          },
        },
      );
    } catch (e) {
      setConectando(false);
      setErro(e instanceof Error ? e.message : "Falha ao iniciar conexão.");
    }
  }, [meta.configId, router]);

  const conectado = conexao && conexao.status === "conectado";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center gap-3">
        <MessageCircle className="h-7 w-7 text-green-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">WhatsApp</h1>
          <p className="text-sm text-slate-500">
            Atendimento e campanhas pela API oficial (coexistência).
          </p>
        </div>
      </header>

      {/* Status da conexão */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        {conectado ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-slate-900">
                  Conectado{conexao?.numero ? ` — ${conexao.numero}` : ""}
                </p>
                <p className="text-sm text-slate-500">
                  {conexao?.verifiedName ?? "Número ativo"}
                  {conexao?.coexistencia ? " · coexistência" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={conectar}
              disabled={conectando}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reconectar
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Link2 className="h-5 w-5 text-slate-400" />
              <span className="font-medium">Nenhum número conectado nesta empresa.</span>
            </div>
            <p className="text-sm text-slate-500">
              Clique abaixo e escaneie o QR code no app WhatsApp Business do celular
              para conectar mantendo o uso no aparelho.
            </p>
            <button
              onClick={conectar}
              disabled={!sdkReady || conectando}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {conectando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Conectar WhatsApp
            </button>
          </div>
        )}
        {erro && (
          <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" /> {erro}
          </p>
        )}
      </section>

      {/* Envio */}
      {conectado && (
        <EnvioBox aba={aba} setAba={setAba} onSent={() => router.refresh()} />
      )}

      {/* Histórico */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
          Histórico recente
        </h2>
        {mensagens.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Nenhuma mensagem ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {mensagens.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {m.direcao === "enviada" ? "→ " : "← "}
                    {m.contato_nome ?? m.contato_numero}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {m.contato_numero}
                    </span>
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {m.tipo === "template"
                      ? `[template] ${m.template_nome ?? ""}`
                      : m.conteudo ?? "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs text-slate-400">
                    {new Date(m.criada_em).toLocaleString("pt-BR")}
                  </span>
                  {m.status && (
                    <p className="text-xs font-medium text-slate-500">{m.status}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EnvioBox({
  aba,
  setAba,
  onSent,
}: {
  aba: "texto" | "template";
  setAba: (v: "texto" | "template") => void;
  onSent: () => void;
}) {
  const [para, setPara] = useState("");
  const [texto, setTexto] = useState("");
  const [templateNome, setTemplateNome] = useState("");
  const [idioma, setIdioma] = useState("pt_BR");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  async function enviar() {
    setMsg(null);
    setEnviando(true);
    try {
      const body =
        aba === "texto"
          ? { para, tipo: "text", texto }
          : { para, tipo: "template", template_nome: templateNome, idioma };
      const res = await fetch("/api/erp/whatsapp/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha no envio");
      setMsg({ ok: true, txt: "Mensagem enviada." });
      setTexto("");
      onSent();
    } catch (e) {
      setMsg({ ok: false, txt: e instanceof Error ? e.message : "Falha no envio" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex gap-2">
        <TabBtn active={aba === "texto"} onClick={() => setAba("texto")}>
          Atendimento (1:1)
        </TabBtn>
        <TabBtn active={aba === "template"} onClick={() => setAba("template")}>
          Campanha (template)
        </TabBtn>
      </div>

      <div className="grid gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Número (com DDI/DDD)</span>
          <input
            value={para}
            onChange={(e) => setPara(e.target.value)}
            placeholder="55 66 99955-4703"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        {aba === "texto" ? (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Mensagem</span>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              placeholder="Escreva a mensagem (válido dentro da janela de 24h)…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Nome do template aprovado</span>
              <input
                value={templateNome}
                onChange={(e) => setTemplateNome(e.target.value)}
                placeholder="ex: boas_vindas"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Idioma</span>
              <input
                value={idioma}
                onChange={(e) => setIdioma(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={enviar}
            disabled={enviando || !para}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </button>
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>
              {msg.txt}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        active ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
