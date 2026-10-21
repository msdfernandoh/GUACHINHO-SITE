"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consultarContasDuplicadas, decidirContaDuplicada } from "./duplicidades-actions";

type Resultado = Awaited<ReturnType<typeof consultarContasDuplicadas>>;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (v: string | null) => v ? v.split("-").reverse().join("/") : "—";

export function DuplicidadesPanel({ onDecisao }: { onDecisao: () => void }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [incluirConferidas, setIncluirConferidas] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const [exclusao, setExclusao] = useState<{ contaId: string; revisao: string; descricao: string; paga: boolean } | null>(null);
  const [motivo, setMotivo] = useState("");

  function analisar(pagina = 1, conferir = incluirConferidas) {
    setAberto(true); setErro(""); setMensagem("");
    iniciar(async () => {
      try { setResultado(await consultarContasDuplicadas(pagina, conferir)); }
      catch (e) { setResultado(null); setErro(e instanceof Error ? e.message : "Não foi possível analisar as contas."); }
    });
  }
  function decidir(contaId: string, revisao: string, decisao: "manter" | "excluir") {
    setErro(""); setMensagem("");
    iniciar(async () => {
      try {
        const resposta = await decidirContaDuplicada({ contaId, revisao, decisao, motivo });
        if (!resposta.ok) { setErro(resposta.message); return; }
        setMensagem(resposta.message); setExclusao(null); setMotivo("");
        onDecisao();
        router.refresh();
        setResultado(await consultarContasDuplicadas(resultado?.pagina || 1, incluirConferidas));
      } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir a decisão. Atualize para verificar o resultado."); }
    });
  }
  return <section id="possiveis-repetidas" className="scroll-mt-24 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm" aria-busy={pendente}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-black text-slate-950">Possíveis contas repetidas</h2>
        <p className="mt-1 text-sm text-slate-600">Mesmo fornecedor, mesmo valor e mesmo mês de ocorrência. Nenhuma conta é excluída automaticamente.</p></div>
      <button type="button" disabled={pendente} onClick={() => analisar()} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50">{pendente ? "Analisando…" : "Analisar contas"}</button>
    </div>
    {aberto && <div className="mt-4 space-y-4">
      <p className="text-xs text-slate-600">Mês de ocorrência = competência da conta; na ausência dela, mês do vencimento. A análise inclui contas abertas e pagas de todo o histórico, além da página atual. Contas canceladas ou sem fornecedor ficam fora.</p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm text-slate-700"><input type="checkbox" checked={incluirConferidas} disabled={pendente} onChange={(e) => { setIncluirConferidas(e.target.checked); analisar(1, e.target.checked); }} className="mr-2"/>Mostrar grupos já conferidos</label>
        <button type="button" disabled={pendente} onClick={() => setAberto(false)} className="text-sm font-bold text-slate-600 underline">Recolher</button>
      </div>
      {erro && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{erro}</p>}
      {mensagem && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</p>}
      {resultado && <>
        <p className="text-sm font-bold text-slate-800">{resultado.totalAnalisadas} contas analisadas · {resultado.totalGrupos} grupos {incluirConferidas ? "encontrados" : "aguardando checagem"}</p>
        {!resultado.totalGrupos && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Nenhum grupo {incluirConferidas ? "de possíveis contas repetidas" : "pendente de checagem"} encontrado.</p>}
        {resultado.grupos.map((g) => <article key={g.revisao} className="overflow-hidden rounded-xl border border-slate-200">
          <h3 className="bg-amber-50 px-4 py-3 font-bold text-slate-950">{g.fornecedor} · {g.mes.split("-").reverse().join("/")} · {brl(g.valor)} por conta · {g.contas.length} ocorrências</h3>
          <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">Conta / descrição</th><th className="p-3">Vencimento</th><th className="p-3">Situação</th><th className="p-3">Valor</th><th className="p-3">Decisão</th></tr></thead>
            <tbody>{g.contas.map((c) => <tr key={c.id} className="border-t border-slate-100 text-slate-800">
              <td className="p-3"><p className="font-bold">{c.descricao}</p><p className="text-xs text-slate-500">{c.id}</p>{c.observacao && <p className="max-w-sm text-xs text-slate-600">{c.observacao}</p>}</td>
              <td className="p-3">{data(c.vencimento)}</td><td className="p-3">{c.status === "paga" ? `Paga em ${data(c.pago_em)}` : "Aberta"}{c.pago_pessoalmente && <p className="text-xs">Paga pessoalmente por sócio</p>}</td><td className="p-3 font-bold">{brl(c.valor)}</td>
              <td className="p-3"><div className="flex gap-2"><button disabled={pendente || c.mantida} type="button" onClick={() => decidir(c.id, g.revisao, "manter")} className="rounded-lg border border-emerald-300 px-3 py-2 font-bold text-emerald-800 disabled:opacity-50">{c.mantida ? "Mantida ✓" : "Manter"}</button>
              <button disabled={pendente} type="button" onClick={() => { setExclusao({ contaId: c.id, revisao: g.revisao, descricao: c.descricao, paga: c.status === "paga" }); setMotivo(""); setErro(""); }} className="rounded-lg border border-rose-300 px-3 py-2 font-bold text-rose-800 disabled:opacity-50">Excluir</button></div></td>
            </tr>)}</tbody></table></div>
        </article>)}
        <div className="flex items-center justify-between gap-3"><button type="button" disabled={pendente || resultado.pagina <= 1} onClick={() => analisar(resultado.pagina - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Anterior</button><span className="text-sm text-slate-600">Página {resultado.pagina} de {resultado.paginas}</span><button type="button" disabled={pendente || resultado.pagina >= resultado.paginas} onClick={() => analisar(resultado.pagina + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Próxima</button></div>
      </>}
      <p className="text-xs text-slate-500">Manter registra sua conferência sem alterar a despesa. Um grupo inteiramente mantido sai da fila; novas contas iguais ou mudanças nos dados exigem nova checagem. Excluir preserva o histórico e segue as permissões financeiras e os bloqueios de fechamento.</p>
    </div>}
    {exclusao && <div role="dialog" aria-modal="true" aria-labelledby="titulo-excluir-repetida" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
      <h3 id="titulo-excluir-repetida" className="text-lg font-black text-slate-950">Excluir esta conta?</h3><p className="mt-2 text-sm text-slate-700">{exclusao.descricao}</p>
      {exclusao.paga && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Esta conta já foi paga. A exclusão pode gerar estorno financeiro e exige a autorização prevista no sistema. Confira o comprovante antes de confirmar.</p>}
      <label className="mt-4 block text-sm font-bold text-slate-800">Motivo obrigatório<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={3} maxLength={500} className="mt-2 w-full rounded-lg border p-3 font-normal"/></label>
      {erro && <p role="alert" className="mt-2 text-sm text-rose-700">{erro}</p>}
      <div className="mt-4 flex justify-end gap-3"><button type="button" disabled={pendente} onClick={() => setExclusao(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button type="button" disabled={pendente || motivo.trim().length < 3} onClick={() => decidir(exclusao.contaId, exclusao.revisao, "excluir")} className="rounded-lg bg-rose-700 px-4 py-2 font-bold text-white disabled:opacity-50">Confirmar exclusão</button></div>
    </div></div>}
  </section>;
}
