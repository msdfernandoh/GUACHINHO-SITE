"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  STATUS_TEMPLATE, componente, normalizarNomeTemplate, preencherTexto, validarTemplate, variaveisDoTexto,
  type BotaoTemplate, type TemplateForm, type TemplateView,
} from "@/lib/whatsapp/cloud-api/templates-shared";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950";
const btn = "inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const btn2 = "inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50";

const VAZIO: TemplateForm = { nome: "", categoria: "MARKETING", idioma: "pt_BR", cabecalhoTipo: "NENHUM", cabecalhoTexto: "", corpo: "", exemplos: [], rodape: "", botoes: [] };

export default function TemplatesClient({ instanciaId, templates, erro, compartilhada }: { instanciaId: string; templates: TemplateView[]; erro: string | null; compartilhada: boolean }) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  async function sincronizar() {
    setBusy(true); setMsg(null);
    const f = new FormData(); f.set("acao", "sincronizar"); f.set("instancia_id", instanciaId);
    const r = await fetch("/api/erp/whatsapp/templates", { method: "POST", body: f });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? { ok: true, t: `${j.total} template(s) sincronizado(s) com a Meta.` } : { ok: false, t: j.error || "Falha ao sincronizar." });
    setBusy(false); router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-bold">Templates da Meta</h2>
          <p className="text-sm text-slate-500">Mensagens aprovadas para iniciar conversa e para os envios automáticos.{compartilhada ? " Esta conta (WABA) é compartilhada pelos números da empresa: os templates valem para todos eles." : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn2} onClick={sincronizar} disabled={busy}><RefreshCw size={16} />{busy ? "Sincronizando…" : "Sincronizar com a Meta"}</button>
          <button className={btn} onClick={() => setCriando(true)}><Plus size={16} />Criar template</button>
        </div>
        {msg && <p role="status" className={"w-full text-sm " + (msg.ok ? "text-emerald-700" : "text-red-700")}>{msg.t}</p>}
        {erro && <p className="w-full text-sm text-red-700">{erro}</p>}
      </section>
      {criando && <CriarTemplate instanciaId={instanciaId} onFechar={() => setCriando(false)} onCriado={(t) => { setCriando(false); setMsg({ ok: true, t }); router.refresh(); }} />}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!templates.length ? (
          <p className="p-5 text-sm text-slate-500">Nenhum template ainda. Clique em Sincronizar com a Meta ou crie o primeiro.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map((t) => {
              const s = STATUS_TEMPLATE[t.status] ?? { rotulo: t.status, cor: "bg-slate-100 text-slate-700" };
              return (
                <li key={t.id} className="grid gap-3 p-5 md:grid-cols-[1fr_280px]">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-bold">{t.nome}</p>
                      <span className={"rounded-full px-2 py-0.5 text-xs font-bold " + s.cor}>{s.rotulo}</span>
                    </div>
                    <p className="text-xs text-slate-500">{t.categoria === "MARKETING" ? "Marketing" : t.categoria === "UTILITY" ? "Utilidade" : t.categoria} · {t.idioma}</p>
                    {t.motivo && <p className="text-sm text-red-700">Motivo: {t.motivo}</p>}
                  </div>
                  <Balao cabecalho={componente(t.componentes, "HEADER")?.text ?? (componente(t.componentes, "HEADER")?.format === "IMAGE" ? "[imagem]" : "")} imagem={t.header_midia_url} corpo={componente(t.componentes, "BODY")?.text ?? ""} rodape={componente(t.componentes, "FOOTER")?.text ?? ""} botoes={(componente(t.componentes, "BUTTONS")?.buttons ?? []).map((b) => b.text)} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Balao({ cabecalho, imagem, corpo, rodape, botoes }: { cabecalho: string; imagem?: string | null; corpo: string; rodape: string; botoes: string[] }) {
  return (
    <div className="rounded-xl bg-[#efeae2] p-3">
      <div className="max-w-xs rounded-lg rounded-tl-none bg-white p-2 text-sm shadow-sm">
        {imagem ? <img src={imagem} alt="" className="mb-2 max-h-40 w-full rounded object-cover" /> : cabecalho === "[imagem]" ? <div className="mb-2 flex h-24 items-center justify-center rounded bg-slate-200 text-xs text-slate-500">imagem</div> : cabecalho ? <p className="mb-1 font-bold">{cabecalho}</p> : null}
        <p className="whitespace-pre-wrap break-words">{corpo || <span className="text-slate-400">Corpo da mensagem…</span>}</p>
        {rodape && <p className="mt-1 text-xs text-slate-500">{rodape}</p>}
        <p className="mt-1 text-right text-[10px] text-slate-400">10:30</p>
      </div>
      {botoes.map((b, i) => <div key={i} className="mt-1 max-w-xs rounded-lg bg-white py-1.5 text-center text-sm font-semibold text-sky-600 shadow-sm">{b}</div>)}
    </div>
  );
}

function CriarTemplate({ instanciaId, onFechar, onCriado }: { instanciaId: string; onFechar: () => void; onCriado: (t: string) => void }) {
  const [f, setF] = useState<TemplateForm>(VAZIO);
  const [imagem, setImagem] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const corpoRef = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof TemplateForm>(k: K, v: TemplateForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const vars = variaveisDoTexto(f.corpo);

  function inserirVariavel() {
    const n = (vars.at(-1) ?? 0) + 1;
    const el = corpoRef.current;
    const pos = el?.selectionStart ?? f.corpo.length;
    const novo = f.corpo.slice(0, pos) + `{{${n}}}` + f.corpo.slice(pos);
    set("corpo", novo.slice(0, 1024));
    setTimeout(() => { el?.focus(); el?.setSelectionRange(pos + 5, pos + 5); }, 0);
  }
  function botao(i: number, b: BotaoTemplate | null) {
    set("botoes", b ? f.botoes.map((x, j) => (j === i ? b : x)) : f.botoes.filter((_, j) => j !== i));
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = validarTemplate(f, !!imagem);
    if (v) { setErro(v); return; }
    setBusy(true); setErro("");
    const fd = new FormData();
    fd.set("acao", "criar"); fd.set("instancia_id", instanciaId); fd.set("dados", JSON.stringify(f));
    if (imagem && f.cabecalhoTipo === "IMAGEM") fd.set("imagem", imagem);
    const r = await fetch("/api/erp/whatsapp/templates", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErro(j.error || "A Meta não aceitou o template."); return; }
    onCriado(`Template ${f.nome} enviado para aprovação da Meta (status: ${STATUS_TEMPLATE[j.status]?.rotulo ?? j.status}).`);
  }

  return (
    <form onSubmit={salvar} className="grid gap-5 rounded-xl border border-emerald-200 bg-white p-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <h2 className="font-bold">Novo template</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold sm:col-span-2">Nome<input className={input + " mt-1 font-mono"} value={f.nome} onChange={(e) => set("nome", normalizarNomeTemplate(e.target.value))} placeholder="boas_vindas_lead" required /></label>
          <label className="text-sm font-semibold">Categoria<select className={input + " mt-1"} value={f.categoria} onChange={(e) => set("categoria", e.target.value as TemplateForm["categoria"])}><option value="MARKETING">Marketing</option><option value="UTILITY">Utilidade</option></select></label>
        </div>
        <p className="text-xs text-slate-500">Idioma: português (pt_BR). Utilidade é para avisos de algo que a pessoa já pediu (proposta, boleto, assembleia); oferta e convite são Marketing.</p>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Cabeçalho</legend>
          <div className="flex gap-4 text-sm">{(["NENHUM", "TEXTO", "IMAGEM"] as const).map((t) => <label key={t} className="flex items-center gap-1"><input type="radio" checked={f.cabecalhoTipo === t} onChange={() => set("cabecalhoTipo", t)} />{t === "NENHUM" ? "Sem cabeçalho" : t === "TEXTO" ? "Texto" : "Imagem"}</label>)}</div>
          {f.cabecalhoTipo === "TEXTO" && <input className={input} maxLength={60} value={f.cabecalhoTexto} onChange={(e) => set("cabecalhoTexto", e.target.value)} placeholder="Gauchinho Consórcios" />}
          {f.cabecalhoTipo === "IMAGEM" && <input type="file" accept="image/jpeg,image/png" className="text-sm" onChange={(e) => { const a = e.target.files?.[0] ?? null; setImagem(a); setPrevia(a ? URL.createObjectURL(a) : null); }} />}
        </fieldset>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold">Corpo</span><button type="button" onClick={inserirVariavel} className="text-sm font-semibold text-emerald-700">+ Inserir variável</button></div>
          <textarea ref={corpoRef} className={input} rows={6} maxLength={1024} value={f.corpo} onChange={(e) => set("corpo", e.target.value)} placeholder="Olá {{1}}, tudo bem? Separei uma condição de consórcio para você…" required />
          <p className="text-xs text-slate-500">{f.corpo.length}/1024 · use *negrito* e _itálico_ como no WhatsApp</p>
          {vars.map((n) => (
            <label key={n} className="block text-sm font-semibold">Exemplo para {`{{${n}}}`} <span className="font-normal text-slate-500">(obrigatório, a Meta usa na análise)</span>
              <input className={input + " mt-1"} value={f.exemplos[n - 1] ?? ""} onChange={(e) => { const ex = [...f.exemplos]; ex[n - 1] = e.target.value; set("exemplos", ex); }} placeholder={n === 1 ? "Maria" : "R$ 350.000,00"} required />
            </label>
          ))}
        </div>
        <label className="block text-sm font-semibold">Rodapé (opcional)<input className={input + " mt-1"} maxLength={60} value={f.rodape} onChange={(e) => set("rodape", e.target.value)} placeholder="Responda SAIR para não receber mais" /></label>
        <div className="space-y-2">
          <span className="text-sm font-semibold">Botões (opcional)</span>
          {f.botoes.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
              <select className={input + " w-40"} value={b.tipo} onChange={(e) => { const t = e.target.value as BotaoTemplate["tipo"]; botao(i, t === "URL" ? { tipo: t, texto: b.texto, url: "https://" } : t === "PHONE_NUMBER" ? { tipo: t, texto: b.texto, telefone: "+55" } : { tipo: t, texto: b.texto }); }}>
                <option value="QUICK_REPLY">Resposta rápida</option><option value="URL">Link</option><option value="PHONE_NUMBER">Telefone</option>
              </select>
              <input className={input + " w-44"} maxLength={25} value={b.texto} onChange={(e) => botao(i, { ...b, texto: e.target.value })} placeholder="Texto do botão" />
              {b.tipo === "URL" && <input className={input + " flex-1"} value={b.url} onChange={(e) => botao(i, { ...b, url: e.target.value })} />}
              {b.tipo === "PHONE_NUMBER" && <input className={input + " flex-1"} value={b.telefone} onChange={(e) => botao(i, { ...b, telefone: e.target.value })} />}
              <button type="button" onClick={() => botao(i, null)} aria-label="Remover botão" className="text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
          {f.botoes.length < 10 && <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => set("botoes", [...f.botoes, { tipo: "QUICK_REPLY", texto: "" }])}>+ Adicionar botão</button>}
        </div>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <div className="flex gap-2"><button className={btn} disabled={busy}>{busy ? "Enviando para a Meta…" : "Salvar e enviar para aprovação"}</button><button type="button" className={btn2} onClick={onFechar}>Cancelar</button></div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Pré-visualização</p>
        <Balao cabecalho={f.cabecalhoTipo === "TEXTO" ? f.cabecalhoTexto : f.cabecalhoTipo === "IMAGEM" ? "[imagem]" : ""} imagem={f.cabecalhoTipo === "IMAGEM" ? previa : null} corpo={preencherTexto(f.corpo, f.exemplos)} rodape={f.rodape} botoes={f.botoes.map((b) => b.texto || "Botão")} />
      </div>
    </form>
  );
}
