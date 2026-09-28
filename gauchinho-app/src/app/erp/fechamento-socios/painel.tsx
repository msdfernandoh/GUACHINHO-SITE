"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldAlert } from "lucide-react";
import { calcularFechamentoSocios } from "@/lib/gestao/fechamento-socios";
import { registrarAporteProprioSocio, registrarFechamentoSocios, salvarMetasComerciaisFechamento, type PainelFechamento } from "./actions";

const brl = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ler = (valor: string) => Number(valor.replace(",", ".")) || 0;
const mesLegivel = (mes: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${mes}-02T12:00:00`));

export function PainelFechamentoSocios({ dados, abaInicial = "despesas" }: { dados: PainelFechamento; abaInicial?: "despesas" | "vendas" }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const lucroAutomatico = dados.margemConsultores + dados.receitasEventos;
  const [lucro] = useState(String(lucroAutomatico));
  const [saldoExtrato, setSaldoExtrato] = useState(String(dados.bancoEmpresa?.saldoSistema || 0));
  const [retiradas, setRetiradas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const [erroAporte, setErroAporte] = useState("");
  const [erroMetas, setErroMetas] = useState("");
  const [aba, setAba] = useState<"despesas" | "vendas">(abaInicial);
  const linkContasPagas = `/erp/contas-pagar?status=pagas&data=pagamento&inicio=${dados.inicio}&fim=${dados.hoje}`;
  const calculo = useMemo(() => {
    try {
      return calcularFechamentoSocios({
        despesasPagas: dados.despesasPagas,
        lucroConsultores: ler(lucro),
        reservaImpostos: dados.reservaImpostos,
        caixaAntes: ler(saldoExtrato),
        socios: dados.socios.map((socio) => ({ ...socio, retirada: ler(retiradas[socio.id] || "0") })),
      });
    } catch { return null; }
  }, [dados, lucro, saldoExtrato, retiradas]);

  function enviar(form: FormData) {
    setErro("");
    iniciar(async () => {
      try {
        await registrarFechamentoSocios(form);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível lacrar o período.");
      }
    });
  }

  function enviarAporte(form: FormData) {
    setErroAporte("");
    iniciar(async () => {
      try {
        await registrarAporteProprioSocio(form);
        router.refresh();
      } catch (e) {
        setErroAporte(e instanceof Error ? e.message : "Não foi possível registrar o aporte.");
      }
    });
  }

  function salvarMetas(form: FormData) {
    setErroMetas("");
    iniciar(async () => {
      try { await salvarMetasComerciaisFechamento(form); router.refresh(); }
      catch (e) { setErroMetas(e instanceof Error ? e.message : "Não foi possível salvar as metas."); }
    });
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl md:p-8">
        <Link href="/erp/financeiro" className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar ao financeiro</Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-widest text-amber-300">Acerto entre os sócios</p><h1 className="mt-2 text-3xl font-black md:text-4xl">Fechar as contas com clareza</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Veja o que entrou, o que foi gasto, quanto cabe a cada sócio e o que continua guardado na empresa.</p></div>
          <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold">{dados.inicio} até {dados.hoje}</span>
        </div>
      </header>

      {dados.bloqueios.length > 0 ? (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-950" role="alert">
          <h2 className="flex items-center gap-2 text-lg font-black"><ShieldAlert className="h-5 w-5" /> Ainda não podemos lacrar</h2>
          <p className="mt-1 text-sm">Estas contas precisam ser conferidas para o acerto não registrar um valor errado:</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{dados.bloqueios.map((bloqueio) => <li key={bloqueio}>{bloqueio}</li>)}</ul>
        </section>
      ) : (
        <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-950"><CheckCircle2 className="mr-2 inline h-5 w-5" /> As verificações automáticas passaram. Confira os valores manuais e o extrato antes de lacrar.</section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Contas já pagas", brl(dados.despesasPagas), `${dados.quantidadePagas} contas; sem abertas e sem guias fiscais`, linkContasPagas],
          ["Repasses recebidos", brl(dados.repassesRecebidos), "Entradas da Racon que já estão no caixa da empresa", "/erp/financeiro?mes=todos&categoria=REPASSE_ADMINISTRADORA"],
          ["Comissões de consultores", brl(dados.comissoesConsultores), "Direito dos consultores e microfranqueados; não é dinheiro livre", "/erp/fechamento-socios#comissoes"],
          ["Margem dos consultores", brl(dados.margemConsultores), "Veja a origem na aba Consultores e vendas", "/erp/fechamento-socios?aba=vendas#detalhe-consultores"],
          ["Receitas de eventos", brl(dados.receitasEventos), "Entrada sem reserva de imposto; também abate despesas", "/erp/financeiro?mes=todos&categoria=RECEITA_EVENTO"],
          ["Impostos já pagos", brl(dados.impostosPagos), "Saíram da reserva, não entram na divisão", linkContasPagas],
          ["Guardado para impostos", brl(dados.reservaImpostos), "Saldo fiscal calculado até hoje", "/erp/minhas-comissoes"],
          ["Saldo no sistema", brl(dados.bancoEmpresa?.saldoSistema || 0), `${dados.bancoEmpresa?.nome || "Conta não identificada"} · precisa conciliar`, "/erp/financeiro?mes=todos"],
          ["Pagas sem saída registrada", brl(dados.despesasEmpresaSemSaida), `${dados.quantidadeDespesasSemSaida} contas; saldo depois delas seria ${brl(dados.saldoAposDespesasPendentes)}`, linkContasPagas],
        ].map(([titulo, valor, legenda, href]) => <Link key={titulo} href={String(href)} target={String(href).startsWith("/") ? "_blank" : undefined} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md"><p className="text-xs font-bold text-slate-600">{titulo}</p><p className="mt-2 text-2xl font-black text-slate-950">{valor}</p><p className="mt-1 text-xs text-slate-500">{legenda}</p><p className="mt-3 text-xs font-black text-indigo-700">Abrir lançamentos →</p></Link>)}
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-700">Olhar mês a mês</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Onde gastamos e como as vendas crescem</h2>
          <p className="mt-1 text-sm text-slate-600">Só usa contas já pagas e vendas registradas. Assim, promessa futura não parece dinheiro ou gasto de hoje.</p>
          <div className="mt-4 flex gap-2 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => setAba("despesas")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${aba === "despesas" ? "bg-white text-indigo-950 shadow-sm" : "text-slate-600"}`}>Despesas por categoria</button>
            <button type="button" onClick={() => setAba("vendas")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${aba === "vendas" ? "bg-white text-indigo-950 shadow-sm" : "text-slate-600"}`}>Consultores e vendas</button>
          </div>
        </div>

        {aba === "despesas" ? <div className="p-5">
          <div className="mb-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950"><strong>Como ler:</strong> vermelho significa que o gasto passou do teto; amarelo mostra aumento contra o mês anterior. Impostos ficam fora deste quadro.</div>
          <div className="space-y-5">{dados.despesasPorMes.map((mes) => <div key={mes.mes} className="rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3"><Link href={`/erp/contas-pagar?status=pagas&data=pagamento&inicio=${mes.mes}-01&fim=${mes.mes}-31`} target="_blank" className="font-black capitalize text-slate-950 hover:text-indigo-700 hover:underline">{mesLegivel(mes.mes)} ↗</Link><Link href={`/erp/contas-pagar?status=pagas&data=pagamento&inicio=${mes.mes}-01&fim=${mes.mes}-31`} target="_blank" className="font-black text-slate-950 hover:text-indigo-700 hover:underline">Total pago: {brl(mes.total)} ↗</Link></div>
            <div className="overflow-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Onde gastamos</th><th className="px-4 py-3 text-right">Pago</th><th className="px-4 py-3 text-right">Teto</th><th className="px-4 py-3 text-right">Mudou</th><th className="px-4 py-3">Aviso</th></tr></thead><tbody>{mes.categorias.map((categoria) => {
              const acimaTeto = categoria.teto !== null && categoria.gasto > categoria.teto;
              const aumentou = categoria.variacao !== null && categoria.variacao > 0;
              const href = categoria.nome === "Sem categoria" ? "/erp/contas-pagar?aba=centro" : `/erp/contas-pagar?status=pagas&data=pagamento&inicio=${mes.mes}-01&fim=${mes.mes}-31&centro=${encodeURIComponent(String(categoria.centroId || ""))}`;
              return <tr key={categoria.nome} className="border-t border-slate-100"><td className="px-4 py-3 font-bold text-slate-950"><Link href={href} target="_blank" className="hover:text-indigo-700 hover:underline">{categoria.nome === "Sem categoria" ? "Sem categoria — incluir categoria ↗" : `${categoria.nome} ↗`}</Link></td><td className="px-4 py-3 text-right font-bold">{brl(categoria.gasto)}</td><td className="px-4 py-3 text-right">{categoria.teto === null ? "Sem teto" : brl(categoria.teto)}</td><td className={`px-4 py-3 text-right font-bold ${aumentou ? "text-amber-700" : "text-slate-600"}`}>{categoria.variacao === null ? "Primeiro mês" : `${categoria.variacao >= 0 ? "+" : ""}${brl(categoria.variacao)}`}</td><td className="px-4 py-3">{acimaTeto ? <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-black text-rose-800">Passou do teto</span> : aumentou ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">Gastou mais</span> : <span className="text-xs font-bold text-emerald-700">Dentro do previsto</span>}</td></tr>;
            })}</tbody></table></div>
          </div>)}{!dados.despesasPorMes.length && <p className="text-sm text-slate-500">Ainda não há contas pagas para comparar.</p>}</div>
          <Link href="/erp/contas-pagar" className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">Editar teto das categorias</Link>
        </div> : <div id="detalhe-consultores" className="p-5">
          <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950"><strong>Como ler:</strong> venda é contrato confirmado e crédito vendido é o valor vendido. Repasses mostram o que entrou da Racon. Eles não são o lucro livre, pois ainda há imposto e comissão.</div>
          <div className="overflow-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Mês</th><th className="px-4 py-3 text-right">Consultores ativos</th><th className="px-4 py-3 text-right">Novos</th><th className="px-4 py-3 text-right">Vendas</th><th className="px-4 py-3 text-right">Crédito vendido</th><th className="px-4 py-3 text-right">Repasses recebidos</th></tr></thead><tbody>{dados.desempenhoConsultores.map((item) => <tr key={item.mes} className="border-t border-slate-100"><td className="px-4 py-3 font-black capitalize text-slate-950">{mesLegivel(item.mes)}</td><td className="px-4 py-3 text-right font-bold">{item.consultoresAtivos}</td><td className="px-4 py-3 text-right">{item.novosConsultores}</td><td className="px-4 py-3 text-right font-bold">{item.vendas}</td><td className="px-4 py-3 text-right font-bold">{brl(item.creditoVendido)}</td><td className="px-4 py-3 text-right font-bold text-emerald-800">{brl(item.repassesGerados)}</td></tr>)}{!dados.desempenhoConsultores.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Ainda não há vendas ou consultores registrados.</td></tr>}</tbody></table></div>
          <form action={salvarMetas} className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><h3 className="font-black text-indigo-950">Meta deste mês</h3><p className="mt-1 text-sm text-indigo-900">Defina o alvo simples para a equipe. Pode alterar quando a estratégia mudar.</p><div className="mt-3 grid gap-3 md:grid-cols-3"><label className="text-xs font-bold text-slate-700">Consultores ativos<input name="meta_consultores" type="number" min="0" step="1" defaultValue={dados.metasComerciais.consultores} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white p-2.5 text-sm text-slate-950" /></label><label className="text-xs font-bold text-slate-700">Vendas realizadas<input name="meta_vendas" type="number" min="0" step="1" defaultValue={dados.metasComerciais.vendas} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white p-2.5 text-sm text-slate-950" /></label><label className="text-xs font-bold text-slate-700">Crédito vendido (R$)<input name="meta_credito" type="number" min="0" step="0.01" defaultValue={dados.metasComerciais.credito} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white p-2.5 text-sm text-slate-950" /></label></div>{erroMetas && <p role="alert" className="mt-3 text-sm font-bold text-rose-800">{erroMetas}</p>}<button type="submit" disabled={pendente} className="mt-3 rounded-xl bg-indigo-800 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Salvar meta do mês</button></form>
        </div>}
      </section>

      <section id="comissoes" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-xl font-black text-slate-950">Comissões separadas por pessoa</h2><p className="mt-1 text-sm text-slate-600">“No caixa” é comissão já recebida e mantida na empresa. “Reservada” é comissão de consultor vinculada ao repasse, ainda destinada a ele.</p></div><div className="overflow-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr><th className="px-5 py-3">Pessoa</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3 text-right">No caixa</th><th className="px-5 py-3 text-right">Reservada</th></tr></thead><tbody>{dados.comissoesPorPessoa.map((item) => <tr key={`${item.papel}:${item.nome}`} className="border-t border-slate-100"><td className="px-5 py-3 font-bold text-slate-950">{item.nome}</td><td className="px-5 py-3 text-slate-600">{item.papel === "SOCIO" ? "Sócio" : "Consultor"}</td><td className="px-5 py-3 text-right font-bold text-indigo-900">{brl(item.recebidaNoCaixa)}</td><td className="px-5 py-3 text-right font-bold text-amber-800">{brl(item.reservada)}</td></tr>)}{!dados.comissoesPorPessoa.length && <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-500">Nenhuma comissão recebida ou reservada neste período.</td></tr>}</tbody></table></div></section>

      <form action={enviar} className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-black text-slate-950">1. O que a empresa ganhou antes de dividir despesas?</h2>
          <p className="mt-1 text-sm text-slate-600">O cálculo vem dos repasses já registrados: tira o imposto e a comissão dos consultores, e usa apenas a margem da empresa. Receitas de eventos sem imposto entram junto.</p>
          <input type="hidden" name="lucro_consultores" value={lucro} />
          <input type="hidden" name="fonte_lucro" value="Cálculo automático pelos repasses confirmados, comissões de consultores e receitas de eventos." />
          <div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-600">Margem dos consultores</p><p className="mt-1 text-xl font-black text-slate-950">{brl(dados.margemConsultores)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-600">Receitas de eventos</p><p className="mt-1 text-xl font-black text-slate-950">{brl(dados.receitasEventos)}</p></div><div className="rounded-xl bg-indigo-50 p-3"><p className="text-xs font-bold text-indigo-700">Total que abate despesas</p><p className="mt-1 text-xl font-black text-indigo-950">{brl(lucroAutomatico)}</p></div></div>
          <div className="mt-4 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-950">{brl(dados.despesasPagas)} em contas pagas − {brl(calculo?.lucroUsadoNasDespesas || 0)} de lucro usado = <strong>{brl(calculo?.despesasDivididas || 0)} para dividir</strong>. {calculo && calculo.lucroRestanteNaEmpresa > 0 && <span> Sobram {brl(calculo.lucroRestanteNaEmpresa)} de lucro na empresa.</span>}</div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-black text-slate-950">2. Quanto cabe a cada sócio?</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{dados.socios.map((socio) => {
            const conta = calculo?.socios.find((item) => item.id === socio.id);
            return <div key={socio.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-lg font-black text-slate-950">{socio.nome} <span className="text-xs text-slate-500">({socio.percentual}%)</span></h3>
              <div className="mt-3 space-y-1 text-sm text-slate-700"><p>Comissão guardada: <strong>{brl(socio.comissaoGuardada)}</strong></p><p>Pagou do próprio bolso: <strong>{brl(socio.adiantamentoPessoal)}</strong></p><p>Deixou do fechamento anterior: <strong>{brl(socio.saldoAnterior)}</strong></p><p>Sua parte nas despesas: <strong>− {brl(conta?.parteDespesas || 0)}</strong></p></div>
              <p className="mt-3 border-t border-slate-200 pt-3 text-sm font-black text-slate-950">{(conta?.direitoAntesRetirada || 0) >= 0 ? "Tem a favor" : "Precisa cobrir"}: {brl(Math.abs(conta?.direitoAntesRetirada || 0))}</p>
              <label className="mt-3 block text-xs font-bold text-slate-700">Quanto vai retirar agora? (R$)<input name={`retirada_${socio.id}`} type="number" min="0" step="0.01" value={retiradas[socio.id] || "0"} onChange={(e) => setRetiradas((anterior) => ({ ...anterior, [socio.id]: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-950" /></label>
              {(conta?.retirada || 0) > 0 && <label className="mt-3 block text-xs font-bold text-slate-700">Comprovante da transferência<input name={`comprovante_${socio.id}`} required minLength={8} placeholder="Identificação da transferência realizada" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-950" /></label>}
              <p className="mt-2 text-xs font-semibold text-indigo-900">Fica na empresa para despesas futuras: {brl(conta?.ficouNaEmpresa || 0)}</p>
            </div>;
          })}</div>
          <p className="mt-4 text-xs text-amber-800">Informe retirada somente depois da transferência real. Ao lacrar, o sistema registrará a saída bancária junto com o comprovante.</p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-black text-slate-950">3. O que continua no caixa da empresa?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
            ["Impostos", calculo?.reservaImpostos || 0], ["Lucro dos consultores que sobrou", calculo?.lucroRestanteNaEmpresa || 0],
            ["Deixado pelos sócios", calculo?.totalDeixadoPelosSocios || 0], ["Caixa após retiradas", calculo?.caixaDepois || 0],
          ].map(([nome, valor]) => <div key={String(nome)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-600">{nome}</p><p className="mt-1 text-lg font-black text-slate-950">{brl(Number(valor))}</p></div>)}</div>
          <p className={`mt-4 rounded-xl p-3 text-sm font-bold ${(calculo?.cobertura || 0) < 0 ? "bg-rose-100 text-rose-900" : "bg-emerald-50 text-emerald-900"}`}>{(calculo?.cobertura || 0) < 0 ? "Falta dinheiro para cobrir os valores reservados: " : "Sobra no caixa após separar esses valores: "}{brl(Math.abs(calculo?.cobertura || 0))}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold text-slate-700">Saldo conferido no extrato da empresa (R$)<input name="saldo_extrato" type="number" min="0" step="0.01" required value={saldoExtrato} onChange={(e) => setSaldoExtrato(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-950" /></label><label className="text-xs font-bold text-slate-700">Referência do extrato<input name="referencia_extrato" minLength={10} required placeholder="Banco, data e identificação do extrato" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-950" /></label></div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><LockKeyhole className="h-5 w-5" /> 4. Registrar e lacrar</h2>
          <p className="mt-2 text-sm text-slate-600">Depois de lacrar, ninguém poderá lançar ou mudar contas pagas, receitas, comissões e movimentos bancários com data até o corte. Correções devem entrar no período seguinte com explicação.</p>
          <input type="hidden" name="fim" value={dados.hoje} />
          <label className="mt-4 block text-xs font-bold text-slate-700">Observações do acerto<textarea name="observacoes" required minLength={20} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-950" placeholder="Descreva os documentos conferidos e a decisão dos sócios." /></label>
          <label className="mt-3 flex items-start gap-2 text-sm font-medium text-slate-700"><input type="checkbox" name="confirmo" value="sim" required className="mt-1" /> Conferi o extrato, o lucro, as comissões, as despesas e a reserva. Entendo que este corte é definitivo.</label>
          {erro && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-900">{erro}</p>}
          <button type="submit" disabled={pendente || dados.bloqueios.length > 0 || !calculo || calculo.cobertura < 0} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-indigo-950 disabled:cursor-not-allowed disabled:opacity-50">{pendente ? "Registrando..." : "Registrar fechamento e lacrar até hoje"}</button>
        </section>
      </form>

      <form action={enviarAporte} className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm md:p-6">
        <h2 className="text-xl font-black text-blue-950">Entrada de dinheiro próprio</h2>
        <p className="mt-1 text-sm text-blue-900">Use somente quando o sócio realmente depositar dinheiro na conta da empresa. Comissão que já está no caixa não entra aqui.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select name="aporte_socio_id" required className="rounded-xl border border-blue-200 bg-white p-3 text-sm text-slate-950"><option value="">Quem colocou o dinheiro?</option>{dados.socios.map((socio) => <option key={socio.id} value={socio.id}>{socio.nome}</option>)}</select>
          <select name="aporte_conta_id" required className="rounded-xl border border-blue-200 bg-white p-3 text-sm text-slate-950"><option value="">Conta que recebeu</option>{dados.contasEmpresa.map((conta) => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}</select>
          <input name="aporte_valor" required inputMode="decimal" placeholder="Valor depositado" className="rounded-xl border border-blue-200 bg-white p-3 text-sm text-slate-950" />
          <input name="aporte_data" required type="date" defaultValue={dados.hoje} className="rounded-xl border border-blue-200 bg-white p-3 text-sm text-slate-950" />
          <input name="aporte_comprovante" required minLength={5} placeholder="Comprovante / PIX" className="rounded-xl border border-blue-200 bg-white p-3 text-sm text-slate-950" />
        </div>
        <input name="aporte_descricao" required minLength={3} placeholder="Ex.: Eroni cobriu a parte que faltou nas despesas de setembro" className="mt-3 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm text-slate-950" />
        {erroAporte && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-900">{erroAporte}</p>}
        <button type="submit" disabled={pendente} className="mt-3 rounded-xl bg-blue-800 px-5 py-3 text-sm font-black text-white disabled:opacity-50">Registrar dinheiro próprio</button>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-xl font-black text-slate-950">Fechamentos registrados</h2>{dados.fechamentos.length === 0 ? <p className="mt-2 text-sm text-slate-600">Ainda não houve fechamento entre os sócios.</p> : <div className="mt-4 space-y-3">{dados.fechamentos.map((f) => <div key={f.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="font-black text-emerald-950">Lacrado: {f.periodo_inicio} a {f.periodo_fim}</p><p className="mt-1 text-emerald-900">Despesas divididas: {brl(f.demonstrativo.despesasDivididas)} · Impostos guardados: {brl(f.demonstrativo.reservaImpostos)} · Sócios deixaram: {brl(f.demonstrativo.totalDeixadoPelosSocios)}</p><p className="mt-1 text-xs text-emerald-800">Registro {f.id}</p></div>)}</div>}</section>
    </div>
  );
}
