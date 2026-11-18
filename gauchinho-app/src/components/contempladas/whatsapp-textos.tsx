"use client";

import { useMemo, useState, useTransition } from "react";
import { gerarPropostaAction } from "@/app/(landing-contempladas)/contempladas/actions";
import { gerarOportunidades, resumirCombinacao, type Combinacao, type CriterioOportunidade } from "@/lib/contempladas/motor";
import { mensagemWhatsApp } from "@/lib/contempladas/mensagens";
import type { CotaPortal } from "@/lib/contempladas/repo";
import type { ConfigPublica } from "@/lib/contempladas/publico";
import { btnOuro, btnSec, inputCls } from "./ui";

type Base = {
  unidadeDe: (c: CotaPortal) => ConfigPublica;
  entradaDe: (c: Combinacao) => number;
  meuWhatsapp: string | null;
  onClose: () => void;
};

function transferenciaDe(c: Combinacao, unidadeDe: Base["unidadeDe"]) {
  return (c.cotas as CotaPortal[]).reduce((s, x) => {
    const u = unidadeDe(x);
    return s + (x.transferencia ?? (x.tipo === "automovel" ? u.transferenciaAuto : u.transferenciaImovel));
  }, 0);
}

function textoDe(c: Combinacao, b: Base, linkProposta?: string | null) {
  const primeira = c.cotas[0] as CotaPortal;
  const u = b.unidadeDe(primeira);
  return mensagemWhatsApp(c, {
    entrada: b.entradaDe(c),
    transferencia: transferenciaDe(c, b.unidadeDe),
    diaVencimento: u.diaVencimento || 10,
    whatsapp: b.meuWhatsapp || u.whatsapp,
    linkProposta,
  });
}

function Mensagem({ texto, onSelecionar }: { texto: string; onSelecionar?: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#e7ffdb] p-3">
      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-snug text-slate-800">{texto}</pre>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200" onClick={() => { navigator.clipboard.writeText(texto); setCopiado(true); }}>{copiado ? "Copiado ✓" : "Copiar"}</button>
        <a className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
        {onSelecionar && <button className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#0047bb] ring-1 ring-slate-200" onClick={onSelecionar}>Selecionar estas cotas</button>}
      </div>
    </div>
  );
}

function Janela({ titulo, children, onClose }: { titulo: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-6" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-lg font-black text-[#0a2a66]">{titulo}</p>
          <button className="rounded-full px-3 py-1 text-2xl text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Texto de WhatsApp da junção selecionada, com opção de gerar a proposta e incluir o link. */
export function TextoJuncao({ cotas, modo, desconto, cliente, clienteTel, ...b }: Base & { cotas: CotaPortal[]; modo: string; desconto: number; cliente: string; clienteTel: string }) {
  const comb = useMemo(() => resumirCombinacao(cotas), [cotas]);
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pend, start] = useTransition();
  return (
    <Janela titulo="Proposta para WhatsApp" onClose={b.onClose}>
      <Mensagem texto={textoDe(comb, b, link)} />
      {!link && (
        <button className={`${btnSec} mt-3 w-full`} disabled={pend}
          onClick={() => start(async () => {
            const r = await gerarPropostaAction({ cotaIds: cotas.map((c) => c.id), modo, desconto, clienteNome: cliente, clienteTelefone: clienteTel });
            if (r.ok) setLink(`${location.origin}/contempladas/p/${r.numero}`);
            else setErro(r.erro);
          })}>{pend ? "Gerando…" : "Gerar proposta e incluir o link na mensagem"}</button>
      )}
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </Janela>
  );
}

/** Gera várias junções boas (sorteadas entre as melhores) com a mensagem de cada uma. */
export function Oportunidades({ cotas, onSelecionar, ...b }: Base & { cotas: CotaPortal[]; onSelecionar: (ids: string[]) => void }) {
  const [criterio, setCriterio] = useState<CriterioOportunidade>("MENOR_ENTRADA");
  const [qtd, setQtd] = useState(6);
  const [lista, setLista] = useState<Combinacao[] | null>(null);
  const [pend, start] = useTransition();
  const gerar = () => start(() => setLista(gerarOportunidades(cotas, criterio, qtd, b.entradaDe)));
  const todos = lista?.map((c) => textoDe(c, b)).join("\n\n") ?? "";
  return (
    <Janela titulo="Gerar oportunidades" onClose={b.onClose}>
      <p className="mb-3 text-sm text-slate-500">O sistema junta cartas disponíveis e sorteia entre as melhores combinações. Clique de novo para outras opções.</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
        <select className={inputCls} value={criterio} onChange={(e) => setCriterio(e.target.value as CriterioOportunidade)}>
          <option value="MENOR_ENTRADA">Menor entrada</option>
          <option value="MENOR_PARCELA">Menor parcela</option>
          <option value="MENOR_TAXA">Menor taxa mensal</option>
        </select>
        <select className={inputCls} value={qtd} onChange={(e) => setQtd(Number(e.target.value))}>
          {[3, 6, 10, 15].map((n) => <option key={n} value={n}>{n} mensagens</option>)}
        </select>
        <button className={btnOuro} disabled={pend || !cotas.length} onClick={gerar}>{pend ? "Gerando…" : lista ? "Gerar outras" : "Gerar"}</button>
      </div>
      {lista && (
        <div className="mt-4 space-y-3">
          {lista.length > 1 && (
            <button className="w-full rounded-xl bg-slate-100 py-2 text-sm font-bold text-slate-700" onClick={() => navigator.clipboard.writeText(todos)}>Copiar todas as mensagens</button>
          )}
          {lista.map((c, i) => (
            <Mensagem key={i + c.cotas.map((x) => x.id).join()} texto={textoDe(c, b)} onSelecionar={() => { onSelecionar(c.cotas.map((x) => x.id)); b.onClose(); }} />
          ))}
          {!lista.length && <p className="text-sm text-slate-500">Nenhuma combinação disponível.</p>}
        </div>
      )}
    </Janela>
  );
}
