"use client";

import { useState } from "react";
import type { carregarExtratoCliente } from "../actions";
import { registrarEnvioExtrato } from "../actions";
import { moedaExtrato as brl } from "@/lib/erp/extrato-cliente";
import { rotuloModalidadeContemplacao } from "@/lib/erp/contemplacoes";
import { CHAVE_MODELO_EXTRATO, MODELO_MENSAGEM_EXTRATO, montarMensagemExtrato } from "@/lib/erp/extrato-mensagem";

type Dados = Awaited<ReturnType<typeof carregarExtratoCliente>>;
const modeloMensagem = MODELO_MENSAGEM_EXTRATO;

export function ExtratoClienteDetalhe({ dados }: { dados: Dados }) {
  const [template, setTemplate] = useState(modeloMensagem);
  const [feedback, setFeedback] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const mensagem = montarMensagemExtrato(template, dados);
  const parametros = new URLSearchParams({ historico: dados.historico, mes: dados.mes });
  const pdf = `/api/erp/extrato-clientes/${dados.cliente.id}/pdf?${parametros}`;
  let telefone = (dados.cliente.telefone ?? "").replace(/\D/g, "");
  if (telefone.length === 10 || telefone.length === 11) telefone = "55" + telefone;
  const whatsapp = "https://wa.me/" + telefone + "?text=" + encodeURIComponent(mensagem);

  return (
    <div className="space-y-5 text-slate-900">
      <h1 className="text-3xl font-black">{dados.cliente.nome}</h1>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <input type="hidden" name="mes" value={dados.mes} />
        <label className="text-sm font-bold">Período das assembleias e da mensagem<select name="historico" defaultValue={dados.historico} className="mt-1 block rounded-lg border p-3"><option value="mes">Mês atual</option><option value="12">Últimos 12 meses</option><option value="todos">Desde a adesão</option></select></label>
        <button className="rounded-lg bg-blue-800 px-4 py-3 font-bold text-white">Atualizar período</button>
        <a href={pdf} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-3 font-bold text-blue-800">Visualizar PDF</a>
        <a href={pdf + "&baixar=1"} className="rounded-lg border px-4 py-3 font-bold text-blue-800">Baixar PDF do cliente</a>
      </form>
      <p className="text-sm text-slate-600">Data-base {dados.hoje.split("-").reverse().join("/")} · Valores estimados de parcelas desde a adesão, considerando pagamentos em dia. A projeção do crédito repete o último reajuste anual e pode acompanhar reajustes das parcelas.</p>
      {dados.cotas.map((c) => (
        <section key={c.id} className={`space-y-4 rounded-2xl border bg-white p-5 ${c.reajustou ? "border-amber-500" : "border-slate-200"}`}>
          <h2 className="text-xl font-black">Grupo {c.grupo} · Cota {c.cota} {c.contemplada ? "· Contemplada" : ""}</h2>
          {c.reajustou && <p className="font-bold text-amber-800">Crédito reajustado em {dados.mes.split("-").reverse().join("/")}</p>}
          <dl className="grid gap-3 sm:grid-cols-3">
            {[["Crédito na adesão", brl(c.contratado)], ["Crédito atualizado", brl(c.atual)], ["Reajuste acumulado", brl(c.valorizacao)], ["Parcelas estimadas desde a adesão", brl(c.totalParcelas)], ["Crédito projetado em 3 anos", brl(c.projecao3)], ["Crédito projetado em 5 anos", brl(c.projecao5)]].map(([label, valor]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 font-bold">{valor}</dd></div>
            ))}
          </dl>
          <p className="text-xs text-slate-600">{c.quantidade} parcelas estimadas · Taxa anual de referência {c.taxa === null ? "indisponível" : c.taxa.toLocaleString("pt-BR") + "%"}.
            {" "}O total das parcelas é estimado pela parcela vigente, proporcionalmente ao histórico do crédito. Valores ausentes ou troca de bem exigem conferência.</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Assembleia</th><th className="p-2">Melhor referência numérica</th><th className="p-2">Distância</th><th className="p-2">Proximidade histórica</th></tr></thead>
            <tbody className="divide-y">{c.assembleias.map((a) => <tr key={a.numero} className={a.evento ? (a.evento.tipo === "contemplada" ? "bg-emerald-50" : "bg-amber-50") : ""}><td className="p-2">{a.data.split("-").reverse().join("/")}</td><td className="p-2">{a.evento ? <strong className={a.evento.tipo === "contemplada" ? "text-emerald-800" : "text-amber-800"}>{a.evento.tipo === "contemplada" ? `Sua cota foi contemplada · ${rotuloModalidadeContemplacao(a.evento.modalidade) ?? "contemplação"}` : `Contemplada por ${(rotuloModalidadeContemplacao(a.evento.modalidade) ?? "lance").toLowerCase()} · lance não pago`}</strong> : a.melhor ? a.melhor.modalidade.replaceAll("_", " ") + " · " + a.melhor.cota : "Sem resultado elegível"}</td><td className="p-2">{a.melhor?.distancia ?? "—"}</td><td className="p-2">{a.percentual === null ? "Indisponível" : a.percentual.toFixed(2).replace(".", ",") + "%"}</td></tr>)}</tbody>
          </table></div>
          {!c.assembleias.length && <p className="text-sm text-slate-600">Sem assembleias verificadas neste período.</p>}
          <p className="text-xs text-slate-600">A proximidade compara a numeração com resultados ativos. Participação e elegibilidade nos lances precisam ser confirmadas. O percentual descreve o histórico e não indica probabilidade futura.</p>
        </section>
      ))}
      <section className="space-y-3 rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-black">Mensagem de WhatsApp</h2>
        <label className="block text-sm font-semibold">Personalize o modelo<textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={8} className="mt-1 w-full rounded-lg border p-3" /></label>
        <p className="text-xs text-slate-600">Variáveis disponíveis {"{cliente}, {periodo}, {credito}, {reajuste}"}. O PDF deve ser anexado na conversa.</p>
        <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm">{mensagem}</pre>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg border px-4 py-3 font-bold" onClick={() => {
            try { localStorage.setItem(CHAVE_MODELO_EXTRATO, template); setFeedback("Modelo salvo neste navegador."); }
            catch { setFeedback("Não foi possível salvar o modelo neste navegador."); }
          }}>Salvar modelo de mensagem</button>
          <button className="rounded-lg border px-4 py-3 font-bold" onClick={() => {
            try { setTemplate(localStorage.getItem(CHAVE_MODELO_EXTRATO) || modeloMensagem); setFeedback("Modelo carregado."); }
            catch { setFeedback("Não foi possível carregar o modelo."); }
          }}>Carregar modelo salvo</button>
          <button className="rounded-lg bg-emerald-800 px-4 py-3 font-bold text-white" onClick={async () => {
            try { await navigator.clipboard.writeText(mensagem); setFeedback("Mensagem copiada."); } catch { setFeedback("Selecione o texto da prévia e copie."); }
          }}>Copiar mensagem de WhatsApp</button>
          <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-3 font-bold text-emerald-800">Abrir WhatsApp</a>
          <button disabled={registrando || enviado} className="rounded-lg border px-4 py-3 font-bold disabled:opacity-50" onClick={async () => {
            setRegistrando(true);
            try { await registrarEnvioExtrato(dados.cliente.id, dados.mes); setEnviado(true); setFeedback("Envio registrado para a competência."); }
            catch (e) { setFeedback(e instanceof Error ? e.message : "Falha ao registrar."); }
            finally { setRegistrando(false); }
          }}>{enviado ? "Envio registrado" : "Marcar como enviado"}</button>
        </div>
        <p role="status" className="text-sm">{feedback}</p>
      </section>
    </div>
  );
}
