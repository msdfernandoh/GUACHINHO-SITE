"use client";
import { useEffect, useRef, useState } from "react";
import { erroSignup } from "@/lib/whatsapp/cloud-api/validation";
type Meta = {
    appId: string;
    configId: string;
    graphVersion: string;
};
declare global {
    interface Window {
        FB?: {
            init: (p: Record<string, unknown>) => void;
            login: (cb: (r: unknown) => void, p: Record<string, unknown>) => void;
        };
        fbAsyncInit?: () => void;
    }
}
export default function ConectarClient({ token, instancia, meta, retorno }: {
    token: string;
    instancia: {
        id: string;
        nome: string;
        numero: string | null;
        coexistencia: boolean;
    };
    meta: Meta;
    retorno: string;
}) {
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");
    const eventRef = useRef<{
        waba_id?: string;
        phone_number_id?: string;
    }>({});
    const erroRef = useRef("");
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true; // Remover o bearer da barra e do histórico antes de carregar scripts externos.
        window.history.replaceState(null, "", "/conectar-whatsapp");
        const init = () => { window.FB?.init({ appId: meta.appId, cookie: true, xfbml: false, autoLogAppEvents: false, version: meta.graphVersion }); setReady(true); };
        if (window.FB)
            init();
        else {
            window.fbAsyncInit = init;
            const js = document.createElement("script");
            js.id = "facebook-jssdk";
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            js.async = true;
            js.onerror = () => setErro("Não foi possível carregar a conexão da Meta. Confira bloqueios de popups e scripts.");
            document.body.appendChild(js);
        }
        return () => { alive.current = false; };
    }, [meta.appId, meta.graphVersion]);
    useEffect(() => { const listener = (e: MessageEvent) => { if (!["https://www.facebook.com", "https://web.facebook.com"].includes(e.origin))
        return; try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP")
            return;
        const error = erroSignup(d);
        if (error) {
            erroRef.current = error;
            setErro(error);
            setBusy(false);
            return;
        }
        if (["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", "FINISH_ONLY_WABA"].includes(d.event)) {
            eventRef.current = d.data || {};
        }
    }
    catch { } }; window.addEventListener("message", listener); return () => window.removeEventListener("message", listener); }, []);
    async function concluir(code: string) { try {
        const deadline = Date.now() + 12000;
        while (!eventRef.current.phone_number_id && !erroRef.current && Date.now() < deadline && alive.current)
            await new Promise(r => setTimeout(r, 100));
        if (!alive.current)
            return;
        if (erroRef.current)
            throw new Error(erroRef.current);
        if (!eventRef.current.phone_number_id || !eventRef.current.waba_id)
            throw new Error("A Meta não retornou os identificadores do número. Reabra pelo ERP e conclua todas as etapas.");
        const res = await fetch("/api/erp/whatsapp/conectar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, instancia_id: instancia.id, code, ...eventRef.current }) });
        const j = await res.json();
        if (!res.ok)
            throw new Error(j.error || "Falha ao conectar.");
        setSucesso("WhatsApp conectado. " + (j.alerta || j.aviso || "Retorne ao ERP e atualize a tela."));
        if (window.opener)
            window.opener.postMessage({ type: "GAUCHINHO_WHATSAPP_CONNECTED", instancia_id: instancia.id }, retorno);
    }
    catch (e) {
        setErro(e instanceof Error ? e.message : "Falha na conexão.");
    }
    finally {
        setBusy(false);
    } }
    function conectar() { if (!window.FB)
        return; setErro(""); erroRef.current = ""; eventRef.current = {}; setBusy(true); try {
        window.FB.login((r: unknown) => { const code = (r as {
            authResponse?: {
                code?: string;
            };
        })?.authResponse?.code; if (code) {
            void concluir(code);
        }
        else {
            setBusy(false);
            setTimeout(() => setErro(erroRef.current || "A Meta não autorizou a conexão. Reabra pelo ERP para tentar novamente."), 350);
        } }, { config_id: meta.configId, response_type: "code", override_default_response_type: true, extras: { setup: {}, ...(instancia.coexistencia ? { featureType: "whatsapp_business_app_onboarding" } : {}), sessionInfoVersion: "3" } });
    }
    catch {
        setErro("Não foi possível abrir a Meta. Libere popups e tente novamente.");
        setBusy(false);
    } }
    return <main className="mx-auto my-12 max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-slate-950 shadow-sm"><p className="text-sm font-bold text-emerald-700">Conexão oficial com a Meta</p><h1 className="mt-2 text-2xl font-bold">{instancia.nome}</h1><p className="mt-3">Número cadastrado: <strong>{instancia.numero || "Confira com o suporte"}</strong></p><p className="my-4 text-sm text-slate-600">{instancia.coexistencia ? "Na janela da Meta, autorize a conta e leia o QR com o WhatsApp Business do celular. O número continua funcionando no aparelho." : "Na janela da Meta, selecione a conta e o número cadastrado para esta franquia."}</p>{sucesso ? <><p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-900">{sucesso}</p><a className="mt-4 inline-block underline" href={retorno + "/erp/whatsapp"}>Voltar ao ERP</a></> : <button disabled={!ready || busy} onClick={conectar} className="rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Conectando…" : ready ? "Conectar pela Meta" : "Carregando Meta…"}</button>}{erro && <p role="alert" className="mt-4 text-sm text-red-700">{erro}</p>}<p className="mt-6 text-xs text-slate-500">O link expira em dez minutos e autoriza uma única tentativa. As configurações são gerenciadas pelo administrador SaaS.</p></main>;
}
