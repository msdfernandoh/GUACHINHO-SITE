"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, X } from "lucide-react";
import { FONTES_VARIAVEL, STATUS_CAMPANHA, preencherTexto, resolverParametros } from "@/lib/whatsapp/cloud-api/templates-shared";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950";
const btn = "inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const btn2 = "inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-50";

export type CampanhaView = {
  id: string; instancia_id: string; instancia: string; nome: string; tipo: "disparo" | "automacao"; template_nome: string; status: string;
  agendada_para: string | null; atraso_minutos: number; ritmo_por_minuto: number; hora_inicio: number; hora_fim: number; ultimo_erro: string | null; created_at: string;
  publico: { fonte?: string; origens?: string[] };
  resumo?: { total: number; pendentes: number; enviados: number; entregues: number; lidos: number; falhas: number; ignorados: number };
};
type Tpl = { nome: string; idioma: string; variaveis: number; corpo: string };

async function post(body: object) {
  const r = await fetch("/api/erp/whatsapp/campanhas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Falha.");
  return j;
}

export default function EnviosClient({ instancia, campanhas, templates, statusLeads, origensLeads, descadastrados, erro }: {
  instancia: { id: string; nome: string; conectada: boolean }; campanhas: CampanhaView[]; templates: Tpl[]; statusLeads: string[]; origensLeads: string[]; descadastrados: number; erro: string | null;
}) {
  const router = useRouter();
  const [novo, setNovo] = useState<null | "disparo" | "automacao">(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const ativas = campanhas.some((c) => ["enviando", "agendada", "ativa"].includes(c.status));
  useEffect(() => { if (!ativas) return; const t = setInterval(() => !document.hidden && router.refresh(), 15000); return () => clearInterval(t); }, [ativas, router]);

  async function acao(id: string, a: string) {
    if (a === "cancelar" && !confirm("Cancelar este envio? Quem ainda não recebeu não vai receber.")) return;
    try { await post({ acao: a, id }); setMsg(null); } catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : "Falha." }); }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">Envios automáticos · {instancia.nome}</h2>
            <p className="text-sm text-slate-500">Disparos para contatos e leads e automações para cada lead novo, sempre com template aprovado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={!instancia.conectada || !templates.length} onClick={() => setNovo("disparo")}><Plus size={16} />Novo disparo</button>
            <button className={btn2 + " py-2"} disabled={!instancia.conectada || !templates.length} onClick={() => setNovo("automacao")}><Plus size={16} />Automação de novo lead</button>
          </div>
        </div>
        <ul className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
          <li>• Envia no ritmo escolhido (padrão 20 por minuto) e só dentro do horário.</li>
          <li>• O mesmo número nunca recebe duas vezes no mesmo envio.</li>
          <li>• Quem responder SAIR ou PARAR sai de todos os envios ({descadastrados} até agora).</li>
          <li>• Se o número desconectar ou o template sair do ar, o envio pausa sozinho.</li>
        </ul>
        {!instancia.conectada && <p className="text-sm text-amber-800">Conecte este número para criar envios.</p>}
        {instancia.conectada && !templates.length && <p className="text-sm text-amber-800">Nenhum template aprovado ainda. Crie um na aba Templates e aguarde a aprovação da Meta.</p>}
        {msg && <p className={"text-sm " + (msg.ok ? "text-emerald-700" : "text-red-700")}>{msg.t}</p>}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
      </section>
      {novo && <NovoEnvio tipo={novo} instanciaId={instancia.id} templates={templates} statusLeads={statusLeads} origensLeads={origensLeads} onFechar={() => setNovo(null)} onCriado={(t) => { setNovo(null); setMsg({ ok: true, t }); router.refresh(); }} />}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!campanhas.length ? <p className="p-5 text-sm text-slate-500">Nenhum envio criado.</p> : (
          <ul className="divide-y divide-slate-100">
            {campanhas.map((c) => {
              const r = c.resumo;
              const feito = r ? r.total - r.pendentes : 0;
              const pct = r?.total ? Math.round((feito / r.total) * 100) : 0;
              return (
                <li key={c.id} className="space-y-2 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{c.nome}</p>
                      <p className="text-xs text-slate-500">
                        {c.tipo === "automacao" ? `Automação · cada lead novo${c.atraso_minutos ? ` após ${c.atraso_minutos} min` : " na hora"}${c.publico.origens?.length ? " · origens: " + c.publico.origens.join(", ") : ""}` : `Disparo · ${({ leads: "leads", contatos: "contatos", whatsapp: "contatos do celular", lista: "lista colada" } as Record<string, string>)[c.publico.fonte ?? ""] ?? ""}`}
                        {" · "}template <span className="font-mono">{c.template_nome}</span> · {c.instancia} · {c.ritmo_por_minuto}/min das {c.hora_inicio}h às {c.hora_fim}h
                        {c.agendada_para ? " · agendado para " + new Date(c.agendada_para).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" }) : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">{STATUS_CAMPANHA[c.status] ?? c.status}</span>
                      {["enviando", "agendada", "ativa"].includes(c.status) && <button className={btn2} onClick={() => acao(c.id, "pausar")}><Pause size={14} />Pausar</button>}
                      {["rascunho", "pausada"].includes(c.status) && <button className={btn2} onClick={() => acao(c.id, c.status === "rascunho" ? "iniciar" : "retomar")}><Play size={14} />{c.status === "rascunho" ? "Iniciar" : "Retomar"}</button>}
                      {!["concluida", "cancelada"].includes(c.status) && <button className={btn2 + " text-red-700"} onClick={() => acao(c.id, "cancelar")}><X size={14} />Cancelar</button>}
                    </div>
                  </div>
                  {r && (
                    <>
                      {c.tipo === "disparo" && <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-600" style={{ width: pct + "%" }} /></div>}
                      <p className="text-xs text-slate-600">{r.total} na fila · {r.enviados} enviadas · {r.entregues} entregues · {r.lidos} lidas · {r.pendentes} aguardando{r.falhas ? ` · ${r.falhas} falhas` : ""}{r.ignorados ? ` · ${r.ignorados} canceladas` : ""}</p>
                    </>
                  )}
                  {c.ultimo_erro && c.status === "pausada" && <p className="text-sm text-red-700">Pausado: {c.ultimo_erro}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Multi({ opcoes, valor, onChange }: { opcoes: string[]; valor: string[]; onChange: (v: string[]) => void }) {
  if (!opcoes.length) return <p className="text-xs text-slate-500">Nenhuma opção cadastrada.</p>;
  return <div className="flex flex-wrap gap-2">{opcoes.map((o) => <label key={o} className={"cursor-pointer rounded-full border px-3 py-1 text-xs " + (valor.includes(o) ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300")}><input type="checkbox" className="hidden" checked={valor.includes(o)} onChange={() => onChange(valor.includes(o) ? valor.filter((x) => x !== o) : [...valor, o])} />{o}</label>)}</div>;
}

function NovoEnvio({ tipo, instanciaId, templates, statusLeads, origensLeads, onFechar, onCriado }: {
  tipo: "disparo" | "automacao"; instanciaId: string; templates: Tpl[]; statusLeads: string[]; origensLeads: string[]; onFechar: () => void; onCriado: (t: string) => void;
}) {
  const [nome, setNome] = useState(tipo === "automacao" ? "Boas-vindas para lead novo" : "");
  const [tpl, setTpl] = useState(templates[0]?.nome ?? "");
  const t = templates.find((x) => x.nome === tpl);
  const [vars, setVars] = useState<string[]>(["primeiro_nome"]);
  const [fonte, setFonte] = useState<"leads" | "contatos" | "whatsapp" | "lista">("leads");
  const [status, setStatus] = useState<string[]>([]);
  const [origens, setOrigens] = useState<string[]>([]);
  const [lista, setLista] = useState("");
  const [agendar, setAgendar] = useState("");
  const [atraso, setAtraso] = useState(5);
  const [ritmo, setRitmo] = useState(20);
  const [hi, setHi] = useState(8);
  const [hf, setHf] = useState(20);
  const [previaBruta, setPrevia] = useState<{ chave: string; total: number; exemplos: { numero: string; nome: string | null }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const publico = { fonte, status, origens, lista };
  const valores = Array.from({ length: t?.variaveis ?? 0 }, (_, i) => vars[i] ?? "fixo:");
  const chave = JSON.stringify(publico);

  async function verPrevia() {
    setBusy(true); setErro("");
    try { setPrevia({ chave, ...(await post({ acao: "previa", instancia_id: instanciaId, publico })) }); } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); }
    setBusy(false);
  }
  async function criar(iniciar: boolean) {
    setBusy(true); setErro("");
    try {
      const j = await post({
        acao: "criar", instancia_id: instanciaId, nome, tipo, template_nome: tpl, template_idioma: t?.idioma ?? "pt_BR", variaveis: valores, publico,
        agendada_para: agendar ? new Date(agendar).toISOString() : null, atraso_minutos: atraso, ritmo_por_minuto: ritmo, hora_inicio: hi, hora_fim: hf, iniciar,
      });
      onCriado(tipo === "automacao" ? (iniciar ? "Automação ativa: cada lead novo vai receber a mensagem." : "Automação salva como rascunho.") : `${j.total} pessoas na fila. ${iniciar ? (agendar ? "O envio começa no horário agendado." : "O envio começa no próximo minuto.") : "Clique em Iniciar quando quiser enviar."}`);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); }
    setBusy(false);
  }
  const previa = previaBruta?.chave === chave ? previaBruta : null;
  const minutos = previa ? Math.ceil(previa.total / ritmo) : 0;

  return (
    <section className="grid gap-5 rounded-xl border border-emerald-200 bg-white p-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <h2 className="font-bold">{tipo === "automacao" ? "Automação: mensagem para cada lead novo" : "Novo disparo"}</h2>
        <label className="block text-sm font-semibold">Nome interno<input className={input + " mt-1"} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Convite evento dezembro" /></label>
        <label className="block text-sm font-semibold">Template aprovado<select className={input + " mt-1"} value={tpl} onChange={(e) => setTpl(e.target.value)}>{templates.map((x) => <option key={x.nome + x.idioma} value={x.nome}>{x.nome}</option>)}</select></label>
        {Array.from({ length: t?.variaveis ?? 0 }, (_, i) => {
          const v = vars[i] ?? "fixo:";
          const fonteV = v.startsWith("fixo:") ? "fixo" : v;
          return (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-semibold">{`{{${i + 1}}}`}<select className={input + " mt-1"} value={fonteV} onChange={(e) => { const n = [...valores]; n[i] = e.target.value === "fixo" ? "fixo:" : e.target.value; setVars(n); }}>{FONTES_VARIAVEL.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
              {fonteV === "fixo" && <label className="text-sm font-semibold">Texto<input className={input + " mt-1"} value={v.slice(5)} onChange={(e) => { const n = [...valores]; n[i] = "fixo:" + e.target.value; setVars(n); }} /></label>}
            </div>
          );
        })}
        {tipo === "disparo" ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Para quem</legend>
            <div className="flex flex-wrap gap-3 text-sm">{([["leads", "Leads"], ["contatos", "Meus contatos"], ["whatsapp", "Contatos do celular (WhatsApp)"], ["lista", "Colar lista"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="radio" checked={fonte === k} onChange={() => setFonte(k)} />{l}</label>)}</div>
            {fonte === "leads" && <><p className="text-xs text-slate-500">Status (vazio = todos)</p><Multi opcoes={statusLeads} valor={status} onChange={setStatus} /><p className="text-xs text-slate-500">Origem (vazio = todas)</p><Multi opcoes={origensLeads} valor={origens} onChange={setOrigens} /></>}
            {fonte === "lista" && <textarea className={input} rows={5} value={lista} onChange={(e) => setLista(e.target.value)} placeholder={"Maria Souza; 66 99999-1234\nJoão; 66988887777"} />}
            <button type="button" className={btn2} onClick={verPrevia} disabled={busy}>Ver quantas pessoas</button>
            {previa && <p className="text-sm text-emerald-800">{previa.total} pessoas com WhatsApp válido{previa.total ? ` · leva cerca de ${minutos < 60 ? minutos + " min" : Math.ceil(minutos / 60) + " h"} no ritmo de ${ritmo}/min` : ""}.</p>}
            <label className="block text-sm font-semibold">Agendar (opcional)<input type="datetime-local" className={input + " mt-1"} value={agendar} onChange={(e) => setAgendar(e.target.value)} /></label>
          </fieldset>
        ) : (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Quais leads novos</legend>
            <p className="text-xs text-slate-500">Origem (vazio = todos os leads que entrarem)</p>
            <Multi opcoes={origensLeads} valor={origens} onChange={setOrigens} />
            <label className="block text-sm font-semibold">Enviar quantos minutos depois que o lead entrar<input type="number" min={0} max={43200} className={input + " mt-1 w-32"} value={atraso} onChange={(e) => setAtraso(Number(e.target.value))} /></label>
            <p className="text-xs text-slate-500">Só leads criados depois de ativar. Cada lead recebe uma vez.</p>
          </fieldset>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold">Por minuto<input type="number" min={1} max={60} className={input + " mt-1"} value={ritmo} onChange={(e) => setRitmo(Number(e.target.value))} /></label>
          <label className="text-sm font-semibold">Das (hora)<input type="number" min={0} max={23} className={input + " mt-1"} value={hi} onChange={(e) => setHi(Number(e.target.value))} /></label>
          <label className="text-sm font-semibold">Até (hora)<input type="number" min={1} max={24} className={input + " mt-1"} value={hf} onChange={(e) => setHf(Number(e.target.value))} /></label>
        </div>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={busy || !nome || !tpl} onClick={() => criar(true)}>{tipo === "automacao" ? "Ativar automação" : agendar ? "Agendar envio" : "Começar a enviar"}</button>
          <button className={btn2 + " py-2"} disabled={busy || !nome || !tpl} onClick={() => criar(false)}>Salvar rascunho</button>
          <button className={btn2 + " py-2"} onClick={onFechar}>Cancelar</button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Como chega (exemplo)</p>
        <div className="rounded-xl bg-[#efeae2] p-3"><div className="rounded-lg rounded-tl-none bg-white p-2 text-sm shadow-sm"><p className="whitespace-pre-wrap">{preencherTexto(t?.corpo ?? "", resolverParametros(valores, previa?.exemplos[0]?.nome ?? "Maria Souza"))}</p></div></div>
      </div>
    </section>
  );
}
