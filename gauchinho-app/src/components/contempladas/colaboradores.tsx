"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { atualizarColaboradorAction, criarColaboradorAction } from "@/app/(landing-contempladas)/contempladas/actions";
import type { Colaborador } from "@/lib/contempladas/acesso";
import { btnOuro, btnSec, Card, inputCls, TelInput } from "./ui";

/** Equipe de colaboradores: quem vende pela revenda/administrador, vendo só o percentual combinado. */
export function Colaboradores({
  itens,
  dono,
  responsaveis,
  authUserId,
}: {
  itens: Colaborador[];
  dono: boolean;
  responsaveis: { authUserId: string; nome: string }[];
  authUserId: string;
}) {
  const router = useRouter();
  const [pend, start] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [novo, setNovo] = useState({ nome: "", email: "", telefone: "", senha: "", percentual: "30", responsavel: authUserId });
  const [pcts, setPcts] = useState<Record<string, string>>({});

  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      setAviso(r.ok ? ok : `⚠️ ${r.erro}`);
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-4">
      <Card className="space-y-2 bg-blue-50/60 p-4 text-sm text-slate-700">
        <p className="font-bold text-slate-900">Como funciona</p>
        <p>O colaborador vende pelas suas cotas, mas <b>não vê a sua comissão</b>: ele enxerga só o percentual que você definir (ex.: 30% da comissão) e pode incluir o próprio ágio em <b>Meu perfil</b>.</p>
        <p>Na venda, a comissão cheia continua sendo sua. O sistema gera para você a comissão a pagar ao colaborador: o percentual dele mais o ágio.</p>
      </Card>

      <Card className="p-4">
        <p className="mb-3 font-bold">Novo colaborador</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <input className={inputCls} placeholder="E-mail" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
          <TelInput value={novo.telefone} onChange={(v) => setNovo({ ...novo, telefone: v })} />
          <input className={inputCls} placeholder="Senha (mín. 8) — não precisa se já tiver acesso" type="password" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} />
          <label className="flex items-center rounded-xl border border-slate-300 bg-white">
            <span className="whitespace-nowrap pl-3 text-sm text-slate-500">Comissão do colaborador</span>
            <input className="w-full bg-transparent px-3 py-2.5 text-right outline-none" type="number" min={0} max={100} step="0.5" value={novo.percentual} onChange={(e) => setNovo({ ...novo, percentual: e.target.value })} />
            <span className="pr-3 text-sm font-semibold text-slate-500">%</span>
          </label>
          {dono && responsaveis.length > 0 ? (
            <select className={inputCls} value={novo.responsavel} onChange={(e) => setNovo({ ...novo, responsavel: e.target.value })}>
              <option value={authUserId}>Responsável: eu (dono do portal)</option>
              {responsaveis.map((r) => <option key={r.authUserId} value={r.authUserId}>Responsável: {r.nome}</option>)}
            </select>
          ) : null}
        </div>
        <button
          disabled={pend}
          className={`${btnOuro} mt-3`}
          onClick={() =>
            rodar(async () => {
              const r = await criarColaboradorAction({ ...novo, percentual: Number(novo.percentual), responsavelAuthId: novo.responsavel });
              if (r.ok) setNovo({ nome: "", email: "", telefone: "", senha: "", percentual: novo.percentual, responsavel: novo.responsavel });
              return r;
            }, "Colaborador cadastrado.")
          }
        >
          Cadastrar colaborador
        </button>
        <p className="mt-2 text-xs text-slate-500">Se o e-mail já tiver acesso (portal ou ERP), ele só é vinculado à sua equipe.</p>
      </Card>

      {aviso ? <p className="rounded-xl bg-slate-100 p-3 text-sm">{aviso}</p> : null}

      <Card className="divide-y">
        {itens.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Nenhum colaborador ainda.</p>
        ) : (
          itens.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold">{c.nome} {c.ativo ? null : <span className="ml-1 rounded bg-slate-200 px-1.5 text-xs">inativo</span>}</p>
                <p className="truncate text-xs text-slate-500">{c.email}{dono ? ` · responsável: ${c.responsavelNome}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center rounded-xl border border-slate-300 bg-white">
                  <input className="w-20 bg-transparent px-2 py-2 text-right outline-none" type="number" min={0} max={100} step="0.5" value={pcts[c.id] ?? String(c.percentual)} onChange={(e) => setPcts({ ...pcts, [c.id]: e.target.value })} />
                  <span className="pr-2 text-sm font-semibold text-slate-500">%</span>
                </label>
                <button disabled={pend || pcts[c.id] == null} className={`${btnSec} !px-3 !py-2 text-sm`} onClick={() => rodar(() => atualizarColaboradorAction(c.id, { percentual: Number(pcts[c.id]) }), "Percentual salvo.")}>Salvar</button>
                <button disabled={pend} className={`${btnSec} !px-3 !py-2 text-sm`} onClick={() => rodar(() => atualizarColaboradorAction(c.id, { ativo: !c.ativo }), c.ativo ? "Colaborador desativado." : "Colaborador ativado.")}>{c.ativo ? "Desativar" : "Ativar"}</button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
