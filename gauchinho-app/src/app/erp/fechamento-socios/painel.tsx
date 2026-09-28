"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldAlert } from "lucide-react";
import { calcularFechamentoSocios } from "@/lib/gestao/fechamento-socios";
import { registrarFechamentoSocios, type PainelFechamento } from "./actions";

const brl = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ler = (valor: string) => Number(valor.replace(",", ".")) || 0;

export function PainelFechamentoSocios({ dados }: { dados: PainelFechamento }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [lucro, setLucro] = useState("0");
  const [saldoExtrato, setSaldoExtrato] = useState(String(dados.bancoEmpresa?.saldoSistema || 0));
  const [retiradas, setRetiradas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
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

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl md:p-8">
        <Link href="/erp/conta-corrente-socios" className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar à conta dos sócios</Link>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Contas já pagas", brl(dados.despesasPagas), `${dados.quantidadePagas} contas; sem abertas e sem guias fiscais`],
          ["Impostos já pagos", brl(dados.impostosPagos), "Saíram da reserva, não entram na divisão"],
          ["Guardado para impostos", brl(dados.reservaImpostos), "Saldo fiscal calculado até hoje"],
          ["Conta da empresa", brl(dados.bancoEmpresa?.saldoSistema || 0), dados.bancoEmpresa?.nome || "Conta não identificada"],
        ].map(([titulo, valor, legenda]) => <div key={titulo} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-600">{titulo}</p><p className="mt-2 text-2xl font-black text-slate-950">{valor}</p><p className="mt-1 text-xs text-slate-500">{legenda}</p></div>)}
      </div>

      <form action={enviar} className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-black text-slate-950">1. Quanto os outros consultores renderam?</h2>
          <p className="mt-1 text-sm text-slate-600">Digite o lucro já conferido da empresa depois de pagar as comissões dos consultores e microfranquias. Esse lucro paga as despesas primeiro; só o restante é dividido entre os sócios.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">Lucro conferido (R$)<input name="lucro_consultores" type="number" min="0" step="0.01" required value={lucro} onChange={(e) => setLucro(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-lg font-bold text-slate-950" /></label>
            <label className="text-xs font-bold text-slate-700">De onde saiu esse valor?<input name="fonte_lucro" required minLength={20} placeholder="Ex.: relatório de repasses e comissões conferido em..." className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-950" /></label>
          </div>
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

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-xl font-black text-slate-950">Fechamentos registrados</h2>{dados.fechamentos.length === 0 ? <p className="mt-2 text-sm text-slate-600">Ainda não houve fechamento entre os sócios.</p> : <div className="mt-4 space-y-3">{dados.fechamentos.map((f) => <div key={f.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="font-black text-emerald-950">Lacrado: {f.periodo_inicio} a {f.periodo_fim}</p><p className="mt-1 text-emerald-900">Despesas divididas: {brl(f.demonstrativo.despesasDivididas)} · Impostos guardados: {brl(f.demonstrativo.reservaImpostos)} · Sócios deixaram: {brl(f.demonstrativo.totalDeixadoPelosSocios)}</p><p className="mt-1 text-xs text-emerald-800">Registro {f.id}</p></div>)}</div>}</section>
    </div>
  );
}
