"use client";

import { useState, useTransition } from "react";
import { solicitarAcessoAction } from "@/app/(landing-contempladas)/contempladas/actions";
import { btnOuro, Card, inputCls, mascaraPix, PixInput, TelInput, type TipoPix } from "./ui";

type Tipo = "ADMINISTRA" | "ADMINISTRA_E_REVENDE" | "REVENDE";
const TIPOS: [Tipo, string, string][] = [
  ["ADMINISTRA", "Vou cadastrar cotas para revenda", "Administrador de cotas: sobe as cartas e as revendas vendem."],
  ["ADMINISTRA_E_REVENDE", "Vou revender e cadastrar cotas", "Administrador de cotas que também vende."],
  ["REVENDE", "Vou apenas vender", "Revenda: oferece as cotas e ganha comissão."],
];

export function SolicitarAcesso({ inicial }: { inicial: Tipo }) {
  const [tipo, setTipo] = useState<Tipo>(inicial);
  const [f, setF] = useState({ nome: "", email: "", telefone: "", senha: "", administradora: "", cidade: "", empresa: "", cnpj: "", cpf: "", pixTipo: "CELULAR", pixChave: "", pixFavorecido: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pend, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  if (ok)
    return (
      <Card className="mx-auto max-w-lg text-center">
        <p className="text-3xl">✅</p>
        <h1 className="text-xl font-black text-[#0a2a66]">Solicitação enviada</h1>
        <p className="mt-2 text-sm text-slate-600">Seu cadastro vai para aprovação. Assim que for liberado, entre em <b>Área do parceiro</b> com o e-mail e a senha que você criou.</p>
      </Card>
    );

  return (
    <Card className="mx-auto max-w-2xl !p-6">
      <h1 className="text-2xl font-black text-[#0a2a66]">Solicitar acesso</h1>
      <p className="mb-5 text-sm text-slate-500">O cadastro passa por aprovação. Acesso só ao portal de cotas contempladas.</p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErro(null);
          start(async () => {
            const r = await solicitarAcessoAction({ tipo, ...f });
            if (r.ok) setOk(true);
            else setErro(r.erro);
          });
        }}
      >
        <div className="grid gap-2">
          {TIPOS.map(([v, l, d]) => (
            <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${tipo === v ? "border-[#0047bb] bg-[#0047bb]/5" : "border-slate-200"}`}>
              <input type="radio" name="tipo" className="mt-1 h-4 w-4 accent-[#0047bb]" checked={tipo === v} onChange={() => setTipo(v)} />
              <span><b className="text-slate-900">{l}</b><span className="block text-xs text-slate-500">{d}</span></span>
            </label>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Nome completo<input className={inputCls} value={f.nome} onChange={set("nome")} required /></label>
          <label className="text-xs font-semibold text-slate-600">CPF<input className={inputCls} inputMode="numeric" placeholder="000.000.000-00" value={f.cpf} onChange={(e) => setF({ ...f, cpf: mascaraPix("CPF", e.target.value) })} required /></label>
          <label className="text-xs font-semibold text-slate-600">WhatsApp<TelInput value={f.telefone} onChange={(v) => setF({ ...f, telefone: v })} required /></label>
          <label className="text-xs font-semibold text-slate-600">Nome da empresa<input className={inputCls} value={f.empresa} onChange={set("empresa")} /></label>
          <label className="text-xs font-semibold text-slate-600">CNPJ<input className={inputCls} inputMode="numeric" placeholder="00.000.000/0000-00" value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: mascaraPix("CNPJ", e.target.value) })} /></label>
          <label className="text-xs font-semibold text-slate-600">Administradora<input className={inputCls} placeholder="Ex.: Racon" value={f.administradora} onChange={set("administradora")} /></label>
          <label className="text-xs font-semibold text-slate-600">Cidade<input className={inputCls} placeholder="Ex.: Sinop - MT" value={f.cidade} onChange={set("cidade")} required /></label>
          <div className="text-xs font-semibold text-slate-600 sm:col-span-2">Chave PIX {tipo === "REVENDE" ? "(opcional)" : "para receber o sinal das suas cotas"}
            <PixInput tipo={f.pixTipo as TipoPix} valor={f.pixChave} onChange={(t, v) => setF({ ...f, pixTipo: t, pixChave: v })} />
          </div>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Favorecido do PIX<input className={inputCls} value={f.pixFavorecido} onChange={set("pixFavorecido")} placeholder="Nome que aparece no PIX" /></label>
          <label className="text-xs font-semibold text-slate-600">E-mail (será seu login)<input className={inputCls} type="email" value={f.email} onChange={set("email")} required /></label>
          <label className="text-xs font-semibold text-slate-600">Senha (mín. 8)<input className={inputCls} type="password" minLength={8} value={f.senha} onChange={set("senha")} required /></label>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className={`${btnOuro} w-full`} disabled={pend}>{pend ? "Enviando…" : "Enviar solicitação"}</button>
      </form>
    </Card>
  );
}
