"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, RefreshCw, Send } from "lucide-react";
import type { InstanciaView, MensagemView } from "@/lib/whatsapp/cloud-api/types";
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950";
const btn = "inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const statusLabel: Record<string, string> = { accepted: "Aceita pela Meta · aguardando envio", pending: "Envio em andamento", sent: "Enviada", delivered: "Entregue ao destinatário", read: "Lida pelo destinatário", received: "Recebida pelo webhook", failed: "Falha na entrega", unknown: "Envio não confirmado · confira antes de repetir", reconciled: "Consolidada em outro registro" };
export default function WhatsappClient({ instancias, selecionadaId, mensagens, erroHistorico }: {
    instancias: InstanciaView[];
    selecionadaId: string;
    mensagens: MensagemView[];
    erroHistorico: string | null;
}) {
    const router = useRouter();
    const [erro, setErro] = useState("");
    const [busy, setBusy] = useState(false);
    const popup = useRef<Window | null>(null);
    const i = instancias.find(i => i.id === selecionadaId);
    useEffect(() => { const handler = (e: MessageEvent) => { if (e.source === popup.current && e.data?.type === "GAUCHINHO_WHATSAPP_CONNECTED" && e.data.instancia_id === selecionadaId) {
        setBusy(false);
        router.refresh();
    } }; window.addEventListener("message", handler); return () => window.removeEventListener("message", handler); }, [router, selecionadaId]);
    useEffect(() => { if (!i || i.status !== "conectado")
        return; const t = setInterval(() => { if (!document.hidden)
        router.refresh(); }, 7000); return () => clearInterval(t); }, [router, i]);
    async function conectar() { setErro(""); setBusy(true); popup.current = window.open("about:blank", "conectar-whatsapp", "width=740,height=820"); if (!popup.current) {
        setErro("Libere popups para conectar o WhatsApp.");
        setBusy(false);
        return;
    } try {
        const r = await fetch("/api/erp/whatsapp/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instancia_id: selecionadaId }) });
        const j = await r.json();
        if (!r.ok)
            throw new Error(j.error || "Falha ao abrir conexão.");
        popup.current.location.href = j.url;
    }
    catch (e) {
        popup.current.close();
        setErro(e instanceof Error ? e.message : "Falha na conexão.");
    }
    finally {
        setBusy(false);
    } }
    const teste = i?.modelo?.modo === "meta_teste";
    const conectado = i?.status === "conectado" && i.modelo?.ativo;
    return <div className="mx-auto max-w-5xl space-y-6 text-slate-950"><header className="flex items-center gap-3"><MessageCircle className="text-emerald-600" size={30}/><div><h1 className="text-2xl font-bold">WhatsApp</h1><p className="text-sm text-slate-500">Números disponibilizados para sua franquia.</p></div></header>{!instancias.length ? <section className="rounded-xl border border-slate-200 bg-white p-6"><p>WhatsApp ainda não liberado para esta empresa. Fale com o suporte.</p></section> : <>
 <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><label className="block text-sm font-semibold">Instância<select className={input + " mt-1"} value={selecionadaId} onChange={e => router.push("/erp/whatsapp?instancia_id=" + e.target.value)}>{instancias.map(i => <option value={i.id} key={i.id}>{i.nome} · {i.numero_celular || "número pendente"} · {i.status}</option>)}</select></label><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{i?.nome}</h2><p className="text-sm">Número esperado: <strong>{i?.numero_celular || "Cadastro pendente"}</strong></p><p className="mt-1 text-sm text-slate-500">{conectado ? "Conectado" : i?.status === "suspenso" ? "Suspenso pelo administrador SaaS" : i?.status === "desconectado" ? "Desconectado" : "Aguardando conexão"}{i?.numero_exibicao ? " · " + i.numero_exibicao : ""}</p></div>{!teste && !conectado && i?.status !== "suspenso" && i?.modelo?.ativo && <button className={btn} onClick={conectar} disabled={busy}>{busy ? "Abrindo…" : "Conectar WhatsApp"}</button>}</div>{teste && <div className="rounded-lg bg-sky-50 p-4 text-sm text-sky-950"><strong>Teste Meta · demonstração</strong><p className="mt-1">Este número é configurado no SaaS e não usa QR. Envie o template hello_world para um destinatário autorizado, mostre o recebimento no celular e responda por ele. O histórico confirma os eventos reais da Meta.</p></div>}{i?.alerta_numero && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{i.alerta_numero}</p>}{i?.ultimo_erro && <p className="text-sm text-red-700">{i.ultimo_erro}</p>}{erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}</section>
 {conectado && i && <EnvioBox key={i.id} instancia={i} onSent={() => router.refresh()}/>}
 <section className="rounded-xl border border-slate-200 bg-white"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold">Histórico desta instância</h2><p className="text-xs text-slate-500">Últimas 50 mensagens · atualiza a cada 7 segundos quando conectado</p></div><button onClick={() => router.refresh()} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><RefreshCw size={16}/>Atualizar</button></header>{erroHistorico && <p className="p-4 text-sm text-red-700">{erroHistorico}</p>}{!mensagens.length ? <p className="p-5 text-sm text-slate-500">Nenhuma mensagem registrada.</p> : <ul className="divide-y divide-slate-100">{mensagens.map(m => <li key={m.id} className="space-y-2 p-5"><div className="flex flex-wrap justify-between gap-3"><p className="text-sm font-bold">{m.direcao === "enviada" ? "→ Enviada para " : "← Recebida de "}{m.contato_nome || m.contato_numero}</p><time className="text-xs text-slate-500">{new Date(m.criada_em).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" })}</time></div><p className="whitespace-pre-wrap break-words text-sm">{m.tipo === "template" ? "Template: " + m.template_nome : m.conteudo || "Mensagem " + m.tipo}</p><p className={"text-xs font-semibold " + (["delivered", "read", "received"].includes(m.status || "") ? "text-emerald-700" : "text-slate-500")}>{statusLabel[m.status || ""] || m.status}</p>{m.erro && <p className="text-xs text-red-700">{m.erro}</p>}{m.wa_message_id && <details className="text-xs text-slate-500"><summary className="cursor-pointer">Identificador da mensagem Meta</summary><code className="break-all">{m.wa_message_id}</code></details>}</li>)}</ul>}</section></>}</div>;
}
function EnvioBox({ instancia, onSent }: {
    instancia: InstanciaView;
    onSent: () => void;
}) {
    const teste = instancia.modelo?.modo === "meta_teste";
    const [tipo, setTipo] = useState<"text" | "template">(teste || !instancia.modelo?.permite_atendimento ? "template" : "text");
    const [para, setPara] = useState("");
    const [texto, setTexto] = useState("");
    const [template, setTemplate] = useState(teste ? "hello_world" : "");
    const [idioma, setIdioma] = useState(teste ? "en_US" : "pt_BR");
    const [busy, setBusy] = useState(false);
    const [resultado, setResultado] = useState("");
    const [erro, setErro] = useState(false);
    const requestId = useRef<string | null>(null);
    async function enviar(e: React.FormEvent) { e.preventDefault(); setBusy(true); setResultado(""); if (!requestId.current)
        requestId.current = crypto.randomUUID(); try {
        const r = await fetch("/api/erp/whatsapp/enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instancia_id: instancia.id, id_envio: requestId.current, para, tipo, ...(tipo === "text" ? { texto } : { template_nome: template, idioma }) }) });
        const j = await r.json();
        if (!r.ok)
            throw new Error(j.error || "Falha no envio.");
        setErro(false);
        setResultado("Mensagem aceita pela Meta. Aguarde o status Entregue e a resposta recebida no histórico.");
        requestId.current = null;
        setTexto("");
        onSent();
    }
    catch (e) {
        setErro(true);
        setResultado(e instanceof Error ? e.message : "Falha no envio.");
        onSent();
    }
    finally {
        setBusy(false);
    } }
    return <form onSubmit={enviar} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">{teste ? "Demonstração com número de teste" : "Enviar mensagem"}</h2><label className="block text-sm font-semibold">Tipo<select className={input + " mt-1"} value={tipo} onChange={e => setTipo(e.target.value as "text" | "template")}>{instancia.modelo?.permite_atendimento && <option value="text">Atendimento · texto livre</option>}{instancia.modelo?.permite_templates && <option value="template">Template aprovado</option>}</select></label><label className="block text-sm font-semibold">Destinatário com DDI e DDD<input className={input + " mt-1"} required value={para} onChange={e => setPara(e.target.value)} placeholder="+5566999999999"/></label>{tipo === "text" ? <label className="block text-sm font-semibold">Mensagem<textarea className={input + " mt-1"} required rows={4} maxLength={4096} value={texto} onChange={e => setTexto(e.target.value)}/><span className="text-xs font-normal text-slate-500">Texto livre é permitido dentro da janela de atendimento da Meta, após mensagem recebida do destinatário.</span></label> : <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Nome do template<input className={input + " mt-1"} required value={template} onChange={e => setTemplate(e.target.value)}/></label><label className="text-sm font-semibold">Idioma<input className={input + " mt-1"} required value={idioma} onChange={e => setIdioma(e.target.value)}/></label></div>}<button className={btn} disabled={busy || !para}><Send size={16}/>{busy ? "Enviando…" : "Enviar mensagem"}</button>{resultado && <p role="status" className={erro ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{resultado}</p>}{erro && <button type="button" onClick={() => { requestId.current = null; setResultado("Novo envio preparado. Confira os dados antes de clicar em Enviar."); setErro(false); }} className="ml-3 text-sm underline">Já conferi o histórico · preparar novo envio</button>}</form>;
}
