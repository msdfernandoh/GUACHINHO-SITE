"use client";

import { useState, useTransition } from "react";
import { agioGerenteAction, enviarCotasAction, preverEnvioAction } from "@/app/(landing-contempladas)/contempladas/actions";
import type { LinhaLida } from "@/lib/contempladas/parser";
import type { Acrescimo } from "@/lib/contempladas/motor";
import { brl, btnOuro, btnSec, Card, inputCls, MoneyInput, Sair } from "./ui";

const descreve = (a: Acrescimo) => (a.valor > 0 ? (a.tipo === "PERCENTUAL" ? `${a.valor}% do crédito` : brl(a.valor)) : "sem ágio");

export function ImportarCotas({ usuario, agioPadrao: agioIni, agioAuto: autoIni, gerentes = [], ehDono = false }: { usuario: string; agioPadrao: Acrescimo; agioAuto: Acrescimo; gerentes?: { authUserId: string; nome: string; unidade: string | null }[]; ehDono?: boolean }) {
  const [gerente, setGerente] = useState("");
  const [agioPadrao, setAgioPadrao] = useState(agioIni);
  const [agioAuto, setAgioAuto] = useState(autoIni);
  const [texto, setTexto] = useState("");
  const [usarPadrao, setUsarPadrao] = useState(true);
  const [tipo, setTipo] = useState<"PERCENTUAL" | "FIXO">(agioPadrao.tipo);
  const [valor, setValor] = useState(agioPadrao.valor);
  const [substituir, setSubstituir] = useState(true);
  const [previa, setPrevia] = useState<LinhaLida[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pend, start] = useTransition();
  const personalizado: Acrescimo | null = usarPadrao ? null : { tipo, valor };
  const validas = previa?.filter((l) => l.cota) ?? [];
  const mudou = () => setPrevia(null);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-slate-600">Logado: <b className="text-slate-900">{usuario}</b></span>
          <Sair />
        </div>
        <textarea
          className={`${inputCls} h-64 font-mono text-xs`}
          placeholder={"Cole aqui a mensagem do WhatsApp ou as linhas da tabela\nracon IMÓVEL R$ 311.000,00 R$ 195.300,00 113 R$ 2.002,26 R$ 226.255,38 dezembro R$ 5.000,00"}
          value={texto}
          onChange={(e) => { setTexto(e.target.value); mudou(); }}
        />

        {ehDono && (
          <label className="mt-4 block text-sm font-semibold">Gerente dono destas cotas
            <select className={`${inputCls} mt-1`} value={gerente}
              onChange={(e) => {
                const g = e.target.value;
                setGerente(g);
                mudou();
                start(async () => { const r = await agioGerenteAction(g || null); setAgioPadrao(r.imovel); setAgioAuto(r.auto); });
              }}>
              <option value="">Minhas (dono do portal)</option>
              {gerentes.map((g) => <option key={g.authUserId} value={g.authUserId}>{g.unidade ? `${g.unidade} · ${g.nome}` : g.nome}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {gerentes.length
                ? "As reservas, o PIX e o WhatsApp dessas cotas vão para o gerente escolhido."
                : <>Nenhum gerente cadastrado ainda. Cadastre em <a className="text-[#0047bb] underline" href="/contempladas/painel">Painel → Equipe</a> (papel Gerente).</>}
            </span>
          </label>
        )}

        <p className="mt-4 text-sm font-semibold">Ágio na entrada</p>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[#0047bb]" checked={usarPadrao} onChange={(e) => { setUsarPadrao(e.target.checked); mudou(); }} />
          Usar configuração padrão <span className="text-[#0047bb]">(imóvel {descreve(agioPadrao)} · veículo {descreve(agioAuto)})</span>
        </label>
        {!usarPadrao && (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["PERCENTUAL", "FIXO"] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setTipo(t); mudou(); }}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${tipo === t ? "border-[#0047bb] bg-[#0047bb]/10 text-[#0047bb]" : "border-slate-300"}`}>
                  {t === "PERCENTUAL" ? "% do crédito" : "Valor fixo (R$)"}
                </button>
              ))}
            </div>
            <div className="mt-2">
              {tipo === "FIXO" ? (
                <MoneyInput value={valor} onChange={(v) => { setValor(v); mudou(); }} />
              ) : (
                <input className={inputCls} type="number" step="0.01" min={0} value={valor || ""} placeholder="Ex.: 2 (% do crédito)" onChange={(e) => { setValor(Number(e.target.value)); mudou(); }} />
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">Vale só para este envio, para imóvel e veículo.</p>
          </>
        )}

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[#0047bb]" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} />
          Substituir as cotas disponíveis atuais (reservadas e vendidas ficam)
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className={btnSec} disabled={!texto.trim() || pend} onClick={() => start(async () => setPrevia(await preverEnvioAction(texto, personalizado, gerente || null)))}>Conferir</button>
          <button className={btnOuro} disabled={!validas.length || pend}
            onClick={() => start(async () => {
              const r = await enviarCotasAction(texto, substituir, personalizado, gerente || null);
              setMsg(r.ok ? `✅ ${r.incluidas} cotas gravadas${r.inativadas ? `, ${r.inativadas} antigas inativadas` : ""}.` : `⚠️ ${r.erro}`);
              if (r.ok) { setTexto(""); setPrevia(null); }
            })}>
            {pend ? "Enviando…" : `Enviar ${validas.length || ""}`}
          </button>
        </div>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </Card>

      <Card className="overflow-x-auto">
        <p className="mb-2 text-sm font-semibold">Prévia {previa ? `· ${validas.length} válidas de ${previa.length}` : ""}</p>
        {!previa ? (
          <p className="text-sm text-slate-500">Clique em Conferir para ver cota por cota antes de enviar.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr><th className="p-1 text-left">Crédito</th><th className="p-1 text-right">Entrada</th><th className="p-1 text-right">Prazo</th><th className="p-1 text-right">Parcela</th><th className="p-1 text-right">Saldo</th><th className="p-1 text-right">Comissão</th></tr>
            </thead>
            <tbody>
              {previa.map((l, i) => l.cota ? (
                <tr key={i} className="border-t border-slate-100">
                  <td className="p-1">{brl(l.cota.credito)}</td>
                  <td className="p-1 text-right">{brl(l.cota.entrada)}{l.cota.entrada_acrescimo > 0 && <span className="block text-[10px] text-[#0047bb]">ágio +{brl(l.cota.entrada_acrescimo)}</span>}</td>
                  <td className="p-1 text-right">{l.cota.prazo}</td>
                  <td className="p-1 text-right">{brl(l.cota.parcela)}</td>
                  <td className="p-1 text-right">{brl(l.cota.saldo_devedor)}</td>
                  <td className="p-1 text-right">{brl(l.cota.comissao_parceiro)}</td>
                </tr>
              ) : (
                <tr key={i} className="border-t border-slate-100 text-red-600"><td colSpan={6} className="p-1">{l.erro} — {l.texto.slice(0, 60)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
