"use client";

import { useEffect, useState, useTransition } from "react";
import { agioGerenteAction, desfazerLoteAction, enviarCotasAction, lerImagemCotasAction, listarLotesAction, preverEnvioAction } from "@/app/(landing-contempladas)/contempladas/actions";
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
  type Lote = Awaited<ReturnType<typeof listarLotesAction>>[number];
  const [lotes, setLotes] = useState<Lote[]>([]);
  const recarregarLotes = () => listarLotesAction().then(setLotes).catch(() => {});
  useEffect(() => { recarregarLotes(); }, []);
  const personalizado: Acrescimo | null = usarPadrao ? null : { tipo, valor };
  // Duplicadas começam desmarcadas; o usuário decide incluir ou não.
  const [fora, setFora] = useState<Set<number>>(new Set());
  // O que fazer com as cotas deste administrador que já estão no portal.
  const [modo, setModo] = useState<"NOVAS" | "VENDER_FORA" | "TODAS">("NOVAS");
  const [lendo, setLendo] = useState<string | null>(null);
  const nomeAdm = gerente ? gerentes.find((g) => g.authUserId === gerente)?.nome ?? "administrador selecionado" : ehDono ? "suas" : "suas";
  const doAdm = gerente ? `do administrador ${nomeAdm}` : "suas (do administrador logado)";
  const lerArquivo = async (f: File) => {
    setMsg(null);
    setPrevia(null);
    if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
      setLendo("Lendo a planilha…");
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        const aba = wb.Sheets[wb.SheetNames[0]];
        setTexto(XLSX.utils.sheet_to_csv(aba, { FS: "\t", blankrows: false }));
      } catch {
        setMsg("⚠️ Não consegui ler a planilha. Copie e cole as linhas.");
      }
      setLendo(null);
      return;
    }
    if (/^image\//.test(f.type)) {
      setLendo("Lendo a imagem… pode levar alguns segundos.");
      // Reduz a imagem no navegador (limite de envio ~1 MB) mantendo a tabela legível.
      const dataUrl = await new Promise<string>((ok, erro) => {
        const img = new Image();
        img.onload = () => {
          const escala = Math.min(1, 2000 / Math.max(img.width, img.height));
          const cv = document.createElement("canvas");
          cv.width = Math.round(img.width * escala);
          cv.height = Math.round(img.height * escala);
          const ctx = cv.getContext("2d");
          if (!ctx) return erro(new Error("canvas"));
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          let q = 0.85;
          let url = cv.toDataURL("image/jpeg", q);
          while (url.length > 900_000 && q > 0.4) { q -= 0.1; url = cv.toDataURL("image/jpeg", q); }
          URL.revokeObjectURL(img.src);
          ok(url);
        };
        img.onerror = erro;
        img.src = URL.createObjectURL(f);
      });
      const r = await lerImagemCotasAction(dataUrl);
      setLendo(null);
      if (!r.ok) { setMsg(`⚠️ ${r.erro}`); return; }
      setTexto(r.texto);
      setMsg("✅ Texto gerado pela leitura da imagem. Confira os valores, escolha abaixo o que fazer com as cotas que já estão no portal e clique em Conferir.");
      return;
    }
    setMsg("⚠️ Envie uma planilha (.xlsx, .xls, .csv) ou uma imagem (PNG, JPG, WEBP).");
  };
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
        <label className="mb-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm hover:bg-slate-100">
          <span><b>Enviar arquivo</b> · planilha (.xlsx, .csv) ou foto/print da tabela</span>
          <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#0047bb] shadow-sm">Escolher</span>
          <input type="file" className="hidden" accept=".xlsx,.xls,.csv,image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerArquivo(f); e.target.value = ""; }} />
        </label>
        {lendo && <p className="mb-2 rounded-lg bg-blue-50 p-2 text-sm text-blue-800">{lendo}</p>}
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
                : <>Nenhum administrador de cotas cadastrado ainda. Cadastre em <a className="text-[#0047bb] underline" href="/contempladas/painel">Painel → Usuários</a> (papel Administrador de cotas).</>}
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
        <fieldset className="mt-4 space-y-2">
          <legend className="mb-1 font-semibold">E as cotas {doAdm} que já estão no portal?</legend>
          <p className="text-xs text-slate-500">Vale só para as cotas {gerente ? `de ${nomeAdm}` : "do administrador deste envio"}. Cotas de outros administradores não mudam.</p>
          {([
            ["NOVAS", "Incluir só as cotas novas e manter as demais", "As cotas que já estão no portal continuam como estão. Cotas repetidas da lista ficam de fora."],
            ["VENDER_FORA", "Incluir só as novas e marcar como vendidas as que não estão na lista", "Use quando a lista é a tabela completa e atualizada: o que ainda estiver disponível no portal e não aparecer nela vira vendida."],
            ["TODAS", "Incluir todas as cotas da lista, mesmo as repetidas", "Nada é retirado nem marcado como vendido; cotas iguais às do portal entram de novo."],
          ] as const).map(([k, t, d]) => (
            <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${modo === k ? "border-[#0047bb] bg-blue-50/60" : "border-slate-200"}`}>
              <input type="radio" name="modo-envio" className="mt-1" checked={modo === k} onChange={() => {
                setModo(k);
                // Repetidas: entram só em "todas".
                if (previa) setFora(k === "TODAS" ? new Set() : new Set(previa.flatMap((l, i) => (l.duplicada ? [i] : []))));
              }} />
              <span><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-slate-500">{d}</span></span>
            </label>
          ))}
        </fieldset>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className={btnSec} disabled={!texto.trim() || pend} onClick={() => start(async () => { const r = await preverEnvioAction(texto, personalizado, gerente || null); setPrevia(r); setFora(modo === "TODAS" ? new Set() : new Set(r.flatMap((l, i) => (l.duplicada ? [i] : [])))); })}>Conferir</button>
          <button className={btnOuro} disabled={(!validas.length && modo !== "VENDER_FORA") || !previa || pend}
            onClick={() => start(async () => {
              if (modo === "VENDER_FORA" && !confirm(`As cotas disponíveis ${doAdm} que não estão nesta lista serão marcadas como vendidas. Continuar?`)) return;
              const r = await enviarCotasAction(texto, personalizado, gerente || null, comissaoLote, [...fora], modo);
              setMsg(r.ok ? `✅ ${r.incluidas} cotas incluídas.${r.vendidasFora ? ` ${r.vendidasFora} marcada(s) como vendida(s).` : ""}` : `⚠️ ${r.erro}`);
              if (r.ok) { setTexto(""); setPrevia(null); recarregarLotes(); }
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
      <Card className="lg:col-span-2">
        <p className="mb-1 text-sm font-semibold">Últimos envios</p>
        <p className="mb-2 text-xs text-slate-500">Errou uma inclusão? Desfazer tira do ar as cotas daquele envio que ainda estão disponíveis. Reservadas e vendidas ficam.</p>
        {!lotes.length && <p className="text-sm text-slate-400">Nenhum envio ainda.</p>}
        <div className="divide-y divide-slate-100">
          {lotes.map((l, i) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <b>{new Date(l.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</b> · {l.quantidade} cota(s) {l.tipos && `de ${l.tipos}`}{l.dono ? ` · ${l.dono}` : ""}
                {i === 0 && !l.desfeitoEm && <span className="ml-2 rounded bg-[#0047bb]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#0047bb]">ÚLTIMO</span>}
                <span className="block text-xs text-slate-500">
                  {l.desfeitoEm ? `Desfeito em ${new Date(l.desfeitoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : `${l.disponiveis} disponível(is)${l.travadas ? ` · ${l.travadas} reservada(s)/vendida(s) ficam` : ""}`}
                </span>
              </span>
              {!l.desfeitoEm && l.disponiveis > 0 && (
                <button className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-200" disabled={pend}
                  onClick={() => {
                    if (!confirm(`Desfazer este envio? ${l.disponiveis} cota(s) disponível(is) saem do portal.`)) return;
                    start(async () => {
                      const r = await desfazerLoteAction(l.id);
                      setMsg(r.ok ? `↩ Envio desfeito: ${r.retiradas} cota(s) retiradas.` : `⚠️ ${r.erro}`);
                      recarregarLotes();
                    });
                  }}>↩ Desfazer</button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
