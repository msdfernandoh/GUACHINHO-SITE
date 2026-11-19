"use client";

import { useState, useTransition } from "react";
import { agioGerenteAction, enviarCotasAction, preverEnvioAction } from "@/app/(landing-contempladas)/contempladas/actions";
import type { LinhaPrevia } from "@/app/(landing-contempladas)/contempladas/actions";
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
  const [comPadrao, setComPadrao] = useState(true);
  const [comTipo, setComTipo] = useState<"PERCENTUAL" | "FIXO">("PERCENTUAL");
  const [comValor, setComValor] = useState(0);
  const comissaoLote: Acrescimo | null = comPadrao ? null : { tipo: comTipo, valor: comValor };
  const [previa, setPrevia] = useState<LinhaPrevia[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pend, start] = useTransition();
  const personalizado: Acrescimo | null = usarPadrao ? null : { tipo, valor };
  // Duplicadas começam desmarcadas; o usuário decide incluir ou não.
  const [fora, setFora] = useState<Set<number>>(new Set());
  const validas = previa?.filter((l, i) => l.cota && !fora.has(i)) ?? [];
  const duplicadas = previa?.filter((l) => l.duplicada).length ?? 0;
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
          placeholder={"Cole aqui a mensagem do WhatsApp ou copie e cole da planilha (com a linha de títulos)\nracon IMÓVEL R$ 311.000,00 R$ 195.300,00 113 R$ 2.002,26 R$ 226.255,38 dezembro R$ 5.000,00"}
          value={texto}
          onChange={(e) => { setTexto(e.target.value); mudou(); }}
        />

        {ehDono && (
          <label className="mt-4 block text-sm font-semibold">Administrador dono destas cotas
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
                ? "As reservas, o PIX e o WhatsApp dessas cotas vão para o administrador escolhido."
                : <>Nenhum administrador de cotas cadastrado ainda. Cadastre em <a className="text-[#0047bb] underline" href="/contempladas/painel">Painel → Equipe</a> (papel Administrador de cotas).</>}
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

        <p className="mt-4 text-sm font-semibold">Comissão da revenda</p>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[#0047bb]" checked={comPadrao} onChange={(e) => setComPadrao(e.target.checked)} />
          Usar a comissão configurada (ou a da tabela de cada cota)
        </label>
        {!comPadrao && (
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
            <select className={`${inputCls} !w-36`} value={comTipo} onChange={(e) => setComTipo(e.target.value as "PERCENTUAL" | "FIXO")}>
              <option value="PERCENTUAL">% do crédito</option>
              <option value="FIXO">R$ fixo</option>
            </select>
            {comTipo === "FIXO" ? <MoneyInput value={comValor} onChange={setComValor} /> : (
              <input className={inputCls} type="number" step="0.01" min={0} value={comValor || ""} placeholder="Ex.: 1 (% do crédito)" onChange={(e) => setComValor(Number(e.target.value))} />
            )}
            <p className="col-span-2 text-xs text-slate-500">Vale só para as cotas deste envio, por cota.</p>
          </div>
        )}
        <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">As cotas novas entram junto com as que já estão no portal. Uma cota só sai quando é marcada como vendida ou excluída.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className={btnSec} disabled={!texto.trim() || pend} onClick={() => start(async () => { const r = await preverEnvioAction(texto, personalizado, gerente || null); setPrevia(r); setFora(new Set(r.flatMap((l, i) => (l.duplicada ? [i] : [])))); })}>Conferir</button>
          <button className={btnOuro} disabled={!validas.length || pend}
            onClick={() => start(async () => {
              const r = await enviarCotasAction(texto, personalizado, gerente || null, comissaoLote, [...fora]);
              setMsg(r.ok ? `✅ ${r.incluidas} cotas incluídas.` : `⚠️ ${r.erro}`);
              if (r.ok) { setTexto(""); setPrevia(null); }
            })}>
            {pend ? "Enviando…" : `Enviar ${validas.length || ""}`}
          </button>
        </div>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </Card>

      <Card className="overflow-x-auto">
        <p className="mb-2 text-sm font-semibold">Prévia {previa ? `· ${validas.length} para incluir de ${previa.length}` : ""}</p>
        {duplicadas > 0 && (
          <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            ⚠ {duplicadas} cota(s) idêntica(s) a uma que já está no portal (mesma administradora, crédito, prazo e entrada). Ficaram desmarcadas: marque só se quiser incluir mesmo assim.
          </p>
        )}
        {!previa ? (
          <p className="text-sm text-slate-500">Clique em Conferir para ver cota por cota antes de enviar.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr><th className="p-1" /><th className="p-1 text-left">Crédito</th><th className="p-1 text-right">Entrada</th><th className="p-1 text-right">Prazo</th><th className="p-1 text-right">Parcela</th><th className="p-1 text-right">Saldo</th><th className="p-1 text-right">Comissão</th></tr>
            </thead>
            <tbody>
              {previa.map((l, i) => l.cota ? (
                <tr key={i} className={`border-t border-slate-100 ${l.duplicada ? "bg-amber-50" : ""} ${fora.has(i) ? "opacity-50" : ""}`}>
                  <td className="p-1"><input type="checkbox" className="h-4 w-4 accent-[#0047bb]" checked={!fora.has(i)} onChange={() => setFora((f) => { const n = new Set(f); if (n.has(i)) n.delete(i); else n.add(i); return n; })} /></td>
                  <td className="p-1">{brl(l.cota.credito)}<span className="block text-[10px] capitalize text-slate-500">{l.cota.administradora} · {l.cota.tipo === "automovel" ? "veículo" : "imóvel"}</span>
                    {l.duplicada && <span className="block text-[10px] font-bold text-amber-800">⚠ Idêntica a {l.duplicada.noTexto ? "outra linha deste texto" : `${l.duplicada.codigo}${l.duplicada.dono ? ` (${l.duplicada.dono})` : ""}`}</span>}</td>
                  <td className="p-1 text-right">{brl(l.cota.entrada)}{l.cota.entrada_acrescimo > 0 && <span className="block text-[10px] text-[#0047bb]">ágio +{brl(l.cota.entrada_acrescimo)}</span>}</td>
                  <td className="p-1 text-right">{l.cota.prazo}</td>
                  <td className="p-1 text-right">{brl(l.cota.parcela)}</td>
                  <td className="p-1 text-right">{brl(l.cota.saldo_devedor)}</td>
                  <td className="p-1 text-right">{brl(l.cota.comissao_parceiro)}{l.cota.comissao_fixada && <span className="block text-[10px] text-slate-500">fixa da lista</span>}</td>
                </tr>
              ) : (
                <tr key={i} className="border-t border-slate-100 text-red-600"><td colSpan={7} className="p-1">{l.erro} — {l.texto.slice(0, 60)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
