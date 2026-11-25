"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gerarPropostaAction, leadNegociarAction, marcarVendidaAction, revelarComissaoAction, simularAction } from "@/app/(landing-contempladas)/contempladas/actions";
import { pct, resumirCombinacao, taxaJuncao, valorAcrescimo, type Acrescimo, type Combinacao, type Preferencia } from "@/lib/contempladas/motor";
import type { CotaPortal } from "@/lib/contempladas/repo";
import { brl, btnOuro, btnSec, Card, inputCls, mascaraTelefone, MoneyInput } from "./ui";
import { Negociar } from "./negociar";
import { Oportunidades, TextoJuncao } from "./whatsapp-textos";
import type { ConfigPublica } from "@/lib/contempladas/publico";

const MODOS = [
  ["COMPLETA", "Completa (mensal, semestral e anual)"],
  ["MENSAL", "Só mensal"],
  ["SEMESTRAL", "Semestral antecipado"],
  ["ANUAL", "Anual antecipado (produtor rural)"],
  ["RESUMO", "Média resumida"],
] as const;


const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Stats = { simulacoes: number; preReservas: number; reservasPix: number; vendidas: number };
type Tipo = "todos" | "imovel" | "automovel";

function IconeTipo({ tipo, className = "h-7 w-7" }: { tipo: string; className?: string }) {
  return tipo === "automovel" ? (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="Automóvel"><path d="M3 13l2-5a2 2 0 012-1.4h10A2 2 0 0119 8l2 5v5h-2.5M3 13v5h2.5M3 13h18M7.5 18a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm12 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM7.5 18h9" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="Imóvel"><path d="M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5" /></svg>
  );
}

function Olho({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      {aberto ? <circle cx="12" cy="12" r="3" /> : <path d="M3 3l18 18" />}
    </svg>
  );
}

function Contador({ ate }: { ate: string }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((new Date(ate).getTime() - agora) / 1000));
  if (!s) return null;
  return <span className="font-mono">{String(Math.floor(s / 3600)).padStart(2, "0")}:{String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</span>;
}

function Situacao({ c }: { c: CotaPortal }) {
  if (c.status === "VENDIDA") return <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">✔ Vendida</span>;
  if (c.status === "RESERVADA") return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">⏳ Em análise</span>;
  if (c.preReservas > 0)
    return (
      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800">
        🔥 {c.preReservas} pré-reserva{c.preReservas > 1 ? "s" : ""}{c.preReservaAte && <> · <Contador ate={c.preReservaAte} /></>}
      </span>
    );
  return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Disponível</span>;
}

export function Portal({ cotas: cotasIniciais, stats, logado, adicional, unidades, gerencia, meuWhatsapp = null, comissaoProtegida = false }: { cotas: CotaPortal[]; stats: Stats; logado: string | null; adicional: Acrescimo | null; unidades: Record<string, ConfigPublica>; gerencia: { dono: boolean; authUserId: string } | null; meuWhatsapp?: string | null; comissaoProtegida?: boolean }) {
  // Comissão protegida: só chega ao navegador depois de confirmar a senha no olho.
  const [revelado, setRevelado] = useState<Record<string, number> | null>(null);
  const [pedirSenha, setPedirSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const cotas = useMemo(
    () => (revelado ? cotasIniciais.map((c) => ({ ...c, comissao_parceiro: revelado[c.id] ?? c.comissao_parceiro })) : cotasIniciais),
    [cotasIniciais, revelado],
  );
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("todos");
  const [adm, setAdm] = useState("");
  const [verDisp, setVerDisp] = useState(true);
  const [verAnalise, setVerAnalise] = useState(false);
  const [verVendidas, setVerVendidas] = useState(false);
  const [credito, setCredito] = useState(0);
  const [entrada, setEntrada] = useState(0);
  const [pref, setPref] = useState<Preferencia>("MENOR_PARCELA");
  const [maxCotas, setMaxCotas] = useState(0);
  // Olho discreto: esconde a rentabilidade quando o vendedor está na frente do cliente.
  const [ocultar, setOcultar] = useState(comissaoProtegida);
  useEffect(() => {
    if (comissaoProtegida) return;
    try { setOcultar(localStorage.getItem("contempladas-ocultar-rent") === "1"); } catch {}
  }, [comissaoProtegida]);
  const alternarOculto = () => {
    if (comissaoProtegida && ocultar && !revelado) {
      setErroSenha(null);
      setSenha("");
      setPedirSenha(true);
      return;
    }
    setOcultar((v) => { if (!comissaoProtegida) { try { localStorage.setItem("contempladas-ocultar-rent", v ? "0" : "1"); } catch {} } return !v; });
    // Ao esconder de novo, a comissão protegida sai do navegador.
    if (comissaoProtegida && !ocultar) setRevelado(null);
  };
  const confirmarSenha = async () => {
    const r = await revelarComissaoAction(senha);
    if (!r.ok) { setErroSenha(r.erro ?? "Senha incorreta."); return; }
    setRevelado(r.comissoes);
    setOcultar(false);
    setPedirSenha(false);
    setSenha("");
  };
  const [opcoes, setOpcoes] = useState<{ rotulo: string; c: Combinacao }[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [negociar, setNegociar] = useState<string[] | null>(null);
  // Sem login, "Negociar" pede para entrar ou deixar nome e WhatsApp (vira lead no CRM).
  const [leadIds, setLeadIds] = useState<string[] | null>(null);
  const [lead, setLead] = useState({ nome: "", telefone: "" });
  const [leadMsg, setLeadMsg] = useState<string | null>(null);
  const abrirNegociar = (ids: string[]) => {
    if (logado) { setNegociar(ids); return; }
    setLeadMsg(null);
    setLeadIds(ids);
  };
  const [janela, setJanela] = useState<"texto" | "oportunidades" | null>(null);
  const [modo, setModo] = useState("COMPLETA");
  const [desconto, setDesconto] = useState(0);
  const [cliente, setCliente] = useState("");
  const [clienteTel, setClienteTel] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pend, start] = useTransition();

  const porId = useMemo(() => new Map(cotas.map((c) => [c.id, c])), [cotas]);
  const administradoras = useMemo(() => [...new Set(cotas.map((c) => c.administradora))].sort(), [cotas]);
  const visiveis = cotas.filter(
    (c) =>
      (tipo === "todos" || c.tipo === tipo) &&
      (!adm || c.administradora === adm) &&
      ((verDisp && c.status === "DISPONIVEL") || (verAnalise && c.status === "RESERVADA") || (verVendidas && c.status === "VENDIDA")),
  );
  const escolhidas = sel.map((id) => porId.get(id)).filter(Boolean) as CotaPortal[];
  const resumo = escolhidas.length ? resumirCombinacao(escolhidas) : null;
  // Adicional fixo do vendedor entra sozinho na entrada; desconto aparece na proposta.
  const extraDe = (cr: number) => (logado ? valorAcrescimo(cr, adicional) : 0);
  const extra = resumo ? extraDe(resumo.credito) : 0;
  const desc = logado ? desconto : 0;
  const rentDe = (c: Combinacao, d = 0) => c.comissao + extraDe(c.credito) - d;
  const verRent = Boolean(logado) && !ocultar;
  const disponiveis = cotas.filter((c) => c.status === "DISPONIVEL" && (tipo === "todos" || c.tipo === tipo));
  const negociando = negociar?.map((id) => porId.get(id)).filter(Boolean) as CotaPortal[] | undefined;
  const unidadeDe = (c: CotaPortal) => unidades[c.dono_auth_id ?? ""] ?? unidades[""];
  const nomeUnidade = (c: CotaPortal) => unidadeDe(c)?.unidade || c.dono_nome || "Racon";
  const podeVender = (c: CotaPortal) => Boolean(gerencia) && c.status !== "VENDIDA" && (gerencia!.dono || c.dono_auth_id === gerencia!.authUserId);
  const vender = (c: CotaPortal) => {
    if (!confirm(`Marcar ${c.codigo} (${brl(c.credito)}) como VENDIDA?`)) return;
    start(async () => {
      const r = await marcarVendidaAction(c.id);
      if (!r.ok) setErro(r.erro);
      setSel((s) => s.filter((x) => x !== c.id));
      router.refresh();
    });
  };
  // Taxa efetiva (TIR): cliente recebe crédito − entrada e paga o cronograma de parcelas.
  const taxaDe = (cs: CotaPortal[], entradaCliente: number) => taxaJuncao(cs, entradaCliente);
  const taxaTxt = (cs: CotaPortal[], e: number) => {
    const t = taxaDe(cs, e);
    return t ? `${pct(t.mensal)} a.m. · ${pct(t.anual)} a.a.` : "—";
  };
  const misturaUnidades = new Set(escolhidas.map((c) => c.dono_auth_id ?? "")).size > 1;

  const simular = () =>
    start(async () => {
      setErro(null);
      setAviso(null);
      const r = await simularAction({ credito, entradaMax: entrada || null, preferencia: pref, maxCotas, tipo: tipo === "todos" ? null : tipo });
      const lista: { rotulo: string; c: Combinacao }[] = [];
      if (r.abaixo) lista.push({ rotulo: "Mais próxima abaixo", c: r.abaixo });
      if (r.acima) lista.push({ rotulo: "Mais próxima acima", c: r.acima });
      const chave = (c: Combinacao) => c.cotas.map((x) => x.id).sort().join();
      for (const c of r.proximas) {
        if (lista.length >= 3) break;
        if (!lista.some((x) => chave(x.c) === chave(c))) lista.push({ rotulo: "Outra opção próxima", c });
      }
      setOpcoes(lista);
      if (!lista.length) setErro("Nenhuma cota disponível nesse tipo de bem.");
      else {
        setSel(lista[0].c.cotas.map((x) => x.id));
        if (r.entradaExcedida) setAviso(`Nenhuma combinação cabe em ${brl(entrada)} de entrada. Mostrando as mais próximas do crédito pedido.`);
      }
    });

  const gerar = () =>
    start(async () => {
      const r = await gerarPropostaAction({ cotaIds: sel, modo, desconto: desc, clienteNome: cliente, clienteTelefone: clienteTel });
      if (r.ok) router.push(`/contempladas/p/${r.numero}`);
      else setErro(r.erro);
    });

  return (
    <>
      {leadIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setLeadIds(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {leadMsg === "ok" ? (
              <>
                <p className="text-lg font-bold text-slate-900">Recebemos seu interesse!</p>
                <p className="mt-1 text-sm text-slate-600">Um consultor vai chamar você no WhatsApp para negociar.</p>
                <button className="mt-4 w-full rounded-xl bg-[#0047bb] py-2.5 font-semibold text-white" onClick={() => setLeadIds(null)}>Fechar</button>
              </>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await leadNegociarAction({ cotaIds: leadIds, nome: lead.nome, telefone: lead.telefone });
                  setLeadMsg(r.ok ? "ok" : r.erro ?? "Não foi possível enviar.");
                });
              }}>
                <p className="text-lg font-bold text-slate-900">Negociar esta carta</p>
                <a href="/contempladas/painel" className="mt-3 block w-full rounded-xl border border-[#0047bb] py-2.5 text-center font-semibold text-[#0047bb]">Já tenho login: entrar</a>
                <p className="my-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">ou deixe seu contato</p>
                <input className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0047bb]" placeholder="Seu nome" value={lead.nome} onChange={(e) => setLead({ ...lead, nome: e.target.value })} />
                <input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0047bb]" placeholder="WhatsApp com DDD" inputMode="tel" value={lead.telefone} onChange={(e) => setLead({ ...lead, telefone: e.target.value })} />
                {leadMsg && leadMsg !== "ok" ? <p className="mt-2 text-sm font-semibold text-red-600">{leadMsg}</p> : null}
                <button disabled={pend} className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white disabled:opacity-50">Quero negociar</button>
              </form>
            )}
          </div>
        </div>
      )}
      {pedirSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setPedirSenha(false)}>
          <form className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void confirmarSenha(); }}>
            <p className="font-bold text-slate-900">Mostrar comissões</p>
            <p className="mt-1 text-sm text-slate-500">Digite a sua senha de acesso para ver as comissões.</p>
            <input autoFocus type="password" autoComplete="current-password" className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#0047bb]" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" />
            {erroSenha ? <p className="mt-2 text-sm font-semibold text-red-600">{erroSenha}</p> : null}
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 rounded-xl border border-slate-300 py-2.5 font-semibold" onClick={() => setPedirSenha(false)}>Cancelar</button>
              <button type="submit" className="flex-1 rounded-xl bg-[#0047bb] py-2.5 font-semibold text-white">Mostrar</button>
            </div>
          </form>
        </div>
      )}
      {!logado && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#0047bb]/20 bg-white p-4">
          <p className="text-sm text-slate-600"><b className="text-[#0a2a66]">Quer vender ou anunciar cotas?</b> <a className="font-semibold text-[#0047bb] underline" href="/contempladas/seja-parceiro" target="_blank" rel="noreferrer">Veja como ganhar com a rede ↗</a></p>
          <div className="flex flex-wrap gap-2">
            <a href="/contempladas/solicitar?tipo=revenda" className="rounded-xl bg-[#0047bb] px-4 py-2 text-sm font-bold text-white">Solicitar acesso de revenda</a>
            <a href="/contempladas/solicitar?tipo=administrador" className="rounded-xl border border-[#0047bb] px-4 py-2 text-sm font-bold text-[#0047bb]">Solicitar acesso de Administrador de Cotas</a>
          </div>
        </div>
      )}

      <section className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="mb-3 text-2xl font-black uppercase tracking-tight text-[#0a2a66] sm:text-3xl">Qual bem você deseja?</h1>
          <div className="flex gap-2">
            {([["todos", "Todos"], ["imovel", "Imóvel"], ["automovel", "Automóvel"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => { setTipo(v); setOpcoes(null); }}
                className={`flex h-14 min-w-[88px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${tipo === v ? "border-[#0047bb] bg-[#0047bb] text-white" : "border-slate-300 bg-white text-[#0047bb] hover:border-[#0047bb]"}`}>
                {v !== "todos" && <IconeTipo tipo={v} />}{l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          {administradoras.length > 1 && (
            <label className="text-sm font-semibold text-slate-600">Administradora
              <select className={`${inputCls} mt-1 !w-56`} value={adm} onChange={(e) => setAdm(e.target.value)}>
                <option value="">Todas</option>
                {administradoras.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          )}
          <div className="text-sm font-semibold text-slate-600">Exibir
            <div className="mt-2 flex gap-4 font-normal text-slate-800">
              <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#0047bb]" checked={verDisp} onChange={(e) => setVerDisp(e.target.checked)} />Disponíveis</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#0047bb]" checked={verAnalise} onChange={(e) => setVerAnalise(e.target.checked)} />Em análise</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#0047bb]" checked={verVendidas} onChange={(e) => setVerVendidas(e.target.checked)} />Vendidas</label>
            </div>
          </div>
        </div>
      </section>

      {(() => {
        const soma = (k: "credito" | "entrada" | "saldo_devedor") => visiveis.reduce((t, c) => t + c[k], 0);
        const cards: [string, string, string?][] = [
          ["Cartas no filtro", String(visiveis.length), `${visiveis.filter((c) => c.tipo === "imovel").length} imóveis · ${visiveis.filter((c) => c.tipo === "automovel").length} veículos`],
          ["Crédito somado", brl(soma("credito"))],
          ["Entradas somadas", brl(soma("entrada"))],
          ["Saldo devedor somado", brl(soma("saldo_devedor"))],
        ];
        return (
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map(([l, v, sub], i) => (
              <div key={l} className={`rounded-2xl p-4 shadow-sm ${i === 1 ? "bg-[#0047bb] text-white" : "border border-slate-200 bg-white"}`}>
                <p className={`text-[11px] font-bold uppercase tracking-wide ${i === 1 ? "text-white/75" : "text-slate-500"}`}>{l}</p>
                <p className={`mt-1 text-2xl font-black sm:text-3xl ${i === 1 ? "text-white" : "text-[#0a2a66]"}`}>{v}</p>
                {sub && <p className="text-xs text-slate-500">{sub}</p>}
              </div>
            ))}
          </section>
        );
      })()}

      <Card className="mb-6 !p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-extrabold text-[#0a2a66]">Simule e junte cartas</h2>
            <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => setJanela("oportunidades")}>✨ Gerar oportunidades para WhatsApp</button>
          </div>
          <p className="text-xs text-slate-500">{disponiveis.length} disponíveis · {stats.simulacoes} simulações · {stats.preReservas} pré-reservas · {stats.reservasPix} em análise</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_160px_auto]">
          <label className="text-xs font-semibold text-slate-600">Crédito desejado
            <MoneyInput value={credito} onChange={setCredito} placeholder="3.000.000,00" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Entrada máxima
            <MoneyInput value={entrada} onChange={setEntrada} placeholder="0,00 (opcional)" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Prioridade
            <select className={inputCls} value={pref} onChange={(e) => setPref(e.target.value as Preferencia)}>
              <option value="MENOR_PARCELA">Menor parcela</option>
              <option value="MENOR_PRAZO">Menor prazo</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Juntar até
            <select className={inputCls} value={maxCotas} onChange={(e) => setMaxCotas(Number(e.target.value))}>
              <option value={0}>Todas</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? "cota" : "cotas"}</option>)}
            </select>
          </label>
          <button className={`${btnOuro} self-end`} disabled={!credito || pend} onClick={simular}>{pend ? "Calculando…" : "Encontrar cotas"}</button>
        </div>
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        {aviso && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{aviso}</p>}
        {opcoes && opcoes.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {opcoes.map(({ rotulo, c }) => {
              const ativa = c.cotas.map((x) => x.id).sort().join() === [...sel].sort().join();
              return (
                <button key={rotulo + c.credito} onClick={() => setSel(c.cotas.map((x) => x.id))}
                  className={`rounded-2xl border-2 p-4 text-left transition ${ativa ? "border-[#0047bb] bg-[#0047bb]/5" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#0047bb]">{rotulo}</p>
                  <p className="text-2xl font-black text-[#0a2a66]">{brl(c.credito)}</p>
                  <p className="text-sm text-slate-700">Entrada {brl(c.entrada + extraDe(c.credito))}</p>
                  <p className="mt-1 text-xs text-slate-500">{c.cotas.length} {c.cotas.length > 1 ? "cotas juntas" : "cota"} · média {brl(c.parcelaMedia)}/mês · até {c.prazoMaximo} meses · saldo {brl(c.saldo)}</p>
                  <p className="mt-1 text-xs font-bold text-[#0047bb]">Taxa {taxaTxt(c.cotas as CotaPortal[], c.entrada + extraDe(c.credito))}</p>
                  {verRent && <p className="mt-1 text-xs font-bold text-emerald-700">Sua rentabilidade {brl(rentDe(c))}</p>}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Tabela (desktop) */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="w-full text-[15px]">
          <thead className="bg-[#0047bb] text-left text-sm font-extrabold uppercase tracking-wide text-white">
            <tr>
              <th className="w-12 p-4" />
              <th className="w-12 p-4" />
              <th className="p-4">Cota</th>
              <th className="p-4 text-right">Crédito<span className="block text-[10px] font-semibold normal-case opacity-80">valor da carta</span></th>
              <th className="p-4 text-right">Entrada<span className="block text-[10px] font-semibold normal-case opacity-80">pago na compra</span></th>
              <th className="p-4 text-center">Parcelas<span className="block text-[10px] font-semibold normal-case opacity-80">prazo × valor</span></th>
              <th className="p-4 text-right">Saldo devedor<span className="block text-[10px] font-semibold normal-case opacity-80">a pagar</span></th>
              <th className="p-4 text-center">Taxa<span className="block text-[10px] font-semibold normal-case opacity-80">mensal · anual</span></th>
              <th className="p-4 text-center">1º venc.</th>
              <th className="p-4">Administradora<span className="block text-[10px] font-semibold normal-case opacity-80">unidade</span></th>
              {logado && (
                <th className="p-4 text-right">
                  <button onClick={alternarOculto} className="inline-flex items-center gap-1 opacity-80 hover:opacity-100" title={ocultar ? "Mostrar rentabilidade" : "Ocultar rentabilidade"} aria-label={ocultar ? "Mostrar rentabilidade" : "Ocultar rentabilidade"}>
                    <Olho aberto={!ocultar} />{!ocultar && "Rentab."}
                  </button>
                </th>
              )}
              <th className="p-4">Situação</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c, i) => {
              const marcada = sel.includes(c.id);
              const livre = c.status === "DISPONIVEL";
              return (
                <tr key={c.id} className={`border-t border-slate-100 ${marcada ? "bg-[#0047bb]/5" : i % 2 ? "bg-slate-50/60" : ""}`}>
                  <td className="p-4"><input type="checkbox" className="h-5 w-5 accent-[#0047bb]" disabled={!livre} checked={marcada} onChange={() => setSel((s) => (marcada ? s.filter((x) => x !== c.id) : [...s, c.id]))} /></td>
                  <td className="p-4 text-[#0a2a66]"><IconeTipo tipo={c.tipo} /></td>
                  <td className="p-4 font-semibold text-slate-700">{c.codigo}</td>
                  <td className="p-4 text-right font-bold text-[#0a2a66]">{brl(c.credito)}</td>
                  <td className="p-4 text-right">{brl(c.entrada + extraDe(c.credito))}</td>
                  <td className="p-4 text-center">{c.prazo}x de {brl(c.parcela)}</td>
                  <td className="p-4 text-right text-slate-700">{brl(c.saldo_devedor)}</td>
                  <td className="p-4 text-center text-xs font-semibold text-[#0047bb]">{taxaTxt([c], c.entrada + extraDe(c.credito))}</td>
                  <td className="p-4 text-center text-sm capitalize text-slate-600">{c.vencimento_mes ? MES_CURTO[c.vencimento_mes - 1] : "—"}</td>
                  <td className="p-4"><span className="capitalize">{c.administradora}</span><span className="block text-xs text-slate-500">{nomeUnidade(c)}</span></td>
                  {logado && <td className="p-4 text-right font-semibold text-emerald-700">{ocultar ? <span className="text-slate-300">•••</span> : brl(c.comissao_parceiro + extraDe(c.credito))}</td>}
                  <td className="p-4"><Situacao c={c} />{logado && c.status === "VENDIDA" && (
                    <span className="mt-1 block text-[11px] leading-tight text-slate-500">
                      {c.vendedor_nome ? `Vendedor ${c.vendedor_nome}` : ""}{c.dono_nome ? ` · Gerente ${c.dono_nome}` : ""}<br />{c.vendida_em ? new Date(c.vendida_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}
                    </span>
                  )}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {podeVender(c) && <button className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-700" disabled={pend} onClick={() => vender(c)}>✔ Vendida</button>}
                      {livre && <button className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700" onClick={() => abrirNegociar([c.id])}>Negociar</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!visiveis.length && <tr><td colSpan={13} className="p-10 text-center text-slate-500">Nenhuma cota com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Cartões (celular) */}
      <div className="space-y-3 lg:hidden">
        {logado && (
          <div className="flex justify-end">
            <button onClick={alternarOculto} className="inline-flex items-center gap-1 text-xs text-slate-400" aria-label={ocultar ? "Mostrar rentabilidade" : "Ocultar rentabilidade"}>
              <Olho aberto={!ocultar} />
            </button>
          </div>
        )}
        {visiveis.map((c) => {
          const marcada = sel.includes(c.id);
          const livre = c.status === "DISPONIVEL";
          return (
            <div key={c.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${marcada ? "border-[#0047bb]" : "border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-6 w-6 accent-[#0047bb]" disabled={!livre} checked={marcada} onChange={() => setSel((s) => (marcada ? s.filter((x) => x !== c.id) : [...s, c.id]))} />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xl font-black text-[#0a2a66]">{brl(c.credito)}</p>
                    <span className="text-[#0a2a66]"><IconeTipo tipo={c.tipo} className="h-6 w-6" /></span>
                  </div>
                  <p className="text-sm text-slate-700">Entrada <b>{brl(c.entrada + extraDe(c.credito))}</b> · {c.prazo}x {brl(c.parcela)}</p>
                  <p className="text-xs font-semibold text-[#0047bb]">Taxa {taxaTxt([c], c.entrada + extraDe(c.credito))}</p>
                  <p className="text-xs text-slate-500">Saldo devedor {brl(c.saldo_devedor)}{c.vencimento_mes ? ` · 1º venc. ${MES_CURTO[c.vencimento_mes - 1]}` : ""}</p>
                  {logado && c.status === "VENDIDA" && <p className="text-xs text-slate-500">Vendida {c.vendida_em ? new Date(c.vendida_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}{c.vendedor_nome ? ` · ${c.vendedor_nome}` : ""}{c.dono_nome ? ` · ${c.dono_nome}` : ""}</p>}
                  <p className="text-xs text-slate-500">{c.codigo} · <span className="capitalize">{c.administradora}</span> · {nomeUnidade(c)}{verRent ? ` · rentab. ${brl(c.comissao_parceiro + extraDe(c.credito))}` : ""}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Situacao c={c} />
                    <div className="flex gap-2">
                      {podeVender(c) && <button className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700" disabled={pend} onClick={() => vender(c)}>✔ Vendida</button>}
                      {livre && <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white" onClick={() => abrirNegociar([c.id])}>Negociar</button>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!visiveis.length && <p className="p-6 text-center text-slate-500">Nenhuma cota com esses filtros.</p>}
      </div>

      {resumo && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto max-w-[1600px] space-y-2 px-4 py-3 sm:px-8">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-700">
              <b className="text-[#0a2a66]">{escolhidas.length} cota{escolhidas.length > 1 ? "s" : ""}</b>
              <span>Crédito <b className="text-[#0047bb]">{brl(resumo.credito)}</b></span>
              <span>Entrada <b>{brl(resumo.entrada + extra - desc)}</b>{desc > 0 && <span className="text-xs text-slate-500"> (−{brl(desc)})</span>}</span>
              <span>Média <b>{brl(resumo.parcelaMedia)}</b>/mês</span>
              <span className="text-slate-500">Saldo {brl(resumo.saldo)}</span>
              <span className="font-bold text-[#0047bb]">Taxa {taxaTxt(escolhidas, resumo.entrada + extra - desc)}</span>
              {logado && (
                <button onClick={alternarOculto} className="inline-flex items-center gap-1 font-bold text-emerald-700" aria-label={ocultar ? "Mostrar rentabilidade" : "Ocultar rentabilidade"}>
                  <Olho aberto={!ocultar} />{!ocultar && <>Rentabilidade {brl(rentDe(resumo, desc))}</>}
                </button>
              )}
              {misturaUnidades && <span className="text-xs font-semibold text-amber-700">Cotas de unidades diferentes: dá para gerar a proposta, mas a reserva é feita com cada unidade.</span>}
            </div>
            <div className="grid gap-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <select className={`${inputCls} !py-2 text-sm`} value={modo} onChange={(e) => setModo(e.target.value)}>
                {MODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-1">
                <input className={`${inputCls} !py-2 text-sm`} placeholder="Nome do cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
                <input className={`${inputCls} !py-2 text-sm`} type="tel" inputMode="tel" placeholder="(66) 99999-9999" value={clienteTel} onChange={(e) => setClienteTel(mascaraTelefone(e.target.value))} />
              </div>
              {logado ? (
                <MoneyInput value={desconto} onChange={setDesconto} placeholder="Desconto na entrada" className="[&_input]:!py-2 [&_input]:text-sm" />
              ) : <span className="hidden lg:block" />}
              <div className="flex gap-2">
                <button className={`${btnSec} !py-2`} onClick={() => setSel([])}>Limpar</button>
                <button className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-40" disabled={misturaUnidades}
                  title={misturaUnidades ? "Cotas de unidades diferentes: negocie cada uma separadamente" : undefined} onClick={() => abrirNegociar(sel)}>Negociar</button>
                <button className="rounded-xl border border-emerald-600 px-3 py-2 text-sm font-bold text-emerald-700" onClick={() => setJanela("texto")}>Texto WhatsApp</button>
                <button className={`${btnOuro} !py-2`} disabled={pend} onClick={gerar}>Gerar proposta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {janela === "texto" && escolhidas.length > 0 && (
        <TextoJuncao cotas={escolhidas} modo={modo} desconto={desc} cliente={cliente} clienteTel={clienteTel}
          unidadeDe={unidadeDe} entradaDe={(c) => c.entrada + extraDe(c.credito) - (c.cotas.length === escolhidas.length ? desc : 0)} meuWhatsapp={meuWhatsapp} onClose={() => setJanela(null)} />
      )}
      {janela === "oportunidades" && (
        <Oportunidades cotas={disponiveis.filter((c) => !adm || c.administradora === adm)} onSelecionar={setSel}
          unidadeDe={unidadeDe} entradaDe={(c) => c.entrada + extraDe(c.credito)} meuWhatsapp={meuWhatsapp} onClose={() => setJanela(null)} />
      )}

      {negociando && negociando.length > 0 && (
        <Negociar
          cotas={negociando}
          entrada={negociando.reduce((s, c) => s + c.entrada, 0) + extraDe(negociando.reduce((s, c) => s + c.credito, 0)) - (negociar === sel ? desc : 0)}
          cfg={unidadeDe(negociando[0])}
          onClose={() => setNegociar(null)}
        />
      )}
    </>
  );
}
